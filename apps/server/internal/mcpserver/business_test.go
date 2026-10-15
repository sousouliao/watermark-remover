package mcpserver

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/douyin"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/processing"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/upscale"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/watermark"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/xhs"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type fakeBackend struct {
	calls   atomic.Int32
	picture []byte
	archive []byte
}

func (f *fakeBackend) Remove(ctx context.Context, in watermark.Input) (watermark.Result, error) {
	f.calls.Add(1)
	return watermark.Result{Image: "data:image/png;base64," + base64.StdEncoding.EncodeToString(f.picture), Model: in.Model}, nil
}
func (f *fakeBackend) Enhance(ctx context.Context, in upscale.Input) (string, error) {
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(f.picture), nil
}
func (f *fakeBackend) Parse(context.Context, string) (xhs.Parsed, error) {
	return xhs.Parsed{ResultID: "parsed", Note: xhs.Note{ID: "note", Title: "test"}, ImageCount: 1, ExpiresAt: time.Now().Add(time.Minute)}, nil
}
func tempResult(data []byte) (*os.File, error) {
	f, err := os.CreateTemp("", "mcp-test-*")
	if err != nil {
		return nil, err
	}
	if _, err = f.Write(data); err != nil {
		f.Close()
		os.Remove(f.Name())
		return nil, err
	}
	return f, nil
}
func (f *fakeBackend) Image(context.Context, string, int) (*os.File, string, string, error) {
	file, err := tempResult(f.picture)
	return file, "image/png", "01.png", err
}
func (f *fakeBackend) Archive(context.Context, string) (*os.File, string, error) {
	file, err := tempResult(f.archive)
	return file, "note.zip", err
}

type fakeDouyin struct{ *fakeBackend }

func (f fakeDouyin) Parse(context.Context, string) (douyin.Parsed, error) {
	return douyin.Parsed{ResultID: "douyin-parsed", Item: douyin.Item{ID: "7561234567890123456", Title: "sample"}, MediaType: "images", ImageCount: 1, ExpiresAt: time.Now().Add(time.Minute)}, nil
}

func TestBusinessToolsOverHTTP(t *testing.T) {
	picture, archive := testFiles()
	fake := &fakeBackend{picture: picture, archive: archive}
	backend := &Backend{Watermarks: fake, Upscale: fake, Notes: fake, Douyin: fakeDouyin{fake}, Processing: processing.New()}
	service, err := New(tokenDigest("token"), slog.New(slog.NewTextHandler(io.Discard, nil)), backend)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	host := httptest.NewServer(service)
	defer host.Close()
	backend.PublicURL = host.URL
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client := mcp.NewClient(&mcp.Implementation{Name: "business-test", Version: "1"}, nil)
	session, err := client.Connect(ctx, &mcp.StreamableClientTransport{Endpoint: host.URL + "/api/mcp", HTTPClient: &http.Client{Transport: bearerTransport{"token"}}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	call := func(name string, args any) *mcp.CallToolResult {
		t.Helper()
		out, err := session.CallTool(ctx, &mcp.CallToolParams{Name: name, Arguments: args})
		if err != nil {
			t.Fatal(err)
		}
		if out.IsError {
			t.Fatalf("%s: %+v", name, out)
		}
		return out
	}
	decodeJob := func(out *mcp.CallToolResult) taskView {
		t.Helper()
		data, _ := json.Marshal(out.StructuredContent)
		var job taskView
		if err := json.Unmarshal(data, &job); err != nil {
			t.Fatal(err)
		}
		return job
	}
	submit := func(name string, args any) taskView {
		t.Helper()
		job := decodeJob(call(name, args))
		if job.ID == "" {
			t.Fatal("no jobId")
		}
		done := decodeJob(call("get_task", map[string]any{"jobId": job.ID, "waitSeconds": 1}))
		if done.State != "succeeded" {
			t.Fatalf("%s: %+v", name, done)
		}
		return done
	}
	tools, err := session.ListTools(ctx, nil)
	if err != nil || len(tools.Tools) != 10 {
		t.Fatalf("production tool set: %v %v", tools, err)
	}
	image := "data:image/png;base64," + base64.StdEncoding.EncodeToString(picture)
	args := map[string]any{"requestId": "watermark-1", "image": image}
	removed := submit("remove_watermark", args)
	duplicate := decodeJob(call("remove_watermark", args))
	if duplicate.ID != removed.ID || fake.calls.Load() != 1 {
		t.Fatal("duplicate paid request")
	}
	if removed.Output.Model != "lite" {
		t.Fatal("default model mismatch")
	}
	out := call("get_task_result", map[string]any{"jobId": removed.ID})
	if !bytes.Equal(out.Content[0].(*mcp.ImageContent).Data, picture) {
		t.Fatal("image delivery mismatch")
	}
	metadata, _ := json.Marshal(out.StructuredContent)
	var smallFile FileInfo
	if err := json.Unmarshal(metadata, &smallFile); err != nil || smallFile.DownloadURL == "" {
		t.Fatalf("small image needs a download fallback: %s", metadata)
	}
	var textFile FileInfo
	if err := json.Unmarshal([]byte(out.Content[1].(*mcp.TextContent).Text), &textFile); err != nil || textFile != smallFile {
		t.Fatal("binary result metadata must also be available as text")
	}
	response, err := http.Get(smallFile.DownloadURL)
	if err != nil {
		t.Fatal(err)
	}
	download, err := io.ReadAll(response.Body)
	response.Body.Close()
	if err != nil || response.StatusCode != http.StatusOK || !bytes.Equal(download, picture) {
		t.Fatal("small image fallback must deliver the original bytes without Bearer")
	}
	submit("remove_watermark", map[string]any{"requestId": "watermark-region", "sourceJobId": removed.ID, "model": "flash", "mode": "region", "region": map[string]int{"x1": 1, "y1": 2, "x2": 500, "y2": 600}})
	submit("upscale_image", map[string]any{"requestId": "upscale-1", "sourceJobId": removed.ID, "scale": 4})
	parsed := submit("parse_xhs_note", map[string]any{"requestId": "parse-note-1", "text": "https://www.xiaohongshu.com/explore/6aa27a5b0000000028034dd9"})
	if parsed.Output.Note.ImageCount != 1 || parsed.Output.Note.ResultID != "parsed" {
		t.Fatal("note result mismatch")
	}
	downloaded := submit("get_xhs_image", map[string]any{"requestId": "download-1", "resultId": "parsed", "index": 1})
	submit("upscale_image", map[string]any{"requestId": "upscale-from-xhs", "sourceJobId": downloaded.ID})
	zipped := submit("get_xhs_archive", map[string]any{"requestId": "archive-1", "resultId": "parsed"})
	zipContent := call("get_task_result", map[string]any{"jobId": zipped.ID}).Content[0].(*mcp.EmbeddedResource)
	reader, err := zip.NewReader(bytes.NewReader(zipContent.Resource.Blob), int64(len(zipContent.Resource.Blob)))
	if err != nil || len(reader.File) != 2 {
		t.Fatal("embedded ZIP invalid")
	}
	parsedDouyin := submit("parse_douyin_item", map[string]any{"requestId": "douyin-parse-1", "text": "https://www.douyin.com/note/7561234567890123456"})
	if parsedDouyin.Output.Douyin == nil || parsedDouyin.Output.Douyin.MediaType != "images" || parsedDouyin.Output.Douyin.ResultID != "douyin-parsed" {
		t.Fatal("Douyin metadata mismatch")
	}
	dyImage := submit("get_douyin_image", map[string]any{"requestId": "douyin-image-1", "resultId": "douyin-parsed", "index": 1})
	if !bytes.Equal(call("get_task_result", map[string]any{"jobId": dyImage.ID}).Content[0].(*mcp.ImageContent).Data, picture) {
		t.Fatal("Douyin image delivery mismatch")
	}
	dyZip := submit("get_douyin_archive", map[string]any{"requestId": "douyin-archive-1", "resultId": "douyin-parsed"})
	if !bytes.Equal(call("get_task_result", map[string]any{"jobId": dyZip.ID}).Content[0].(*mcp.EmbeddedResource).Resource.Blob, archive) {
		t.Fatal("Douyin ZIP delivery mismatch")
	}
	invalid, err := session.CallTool(ctx, &mcp.CallToolParams{Name: "parse_douyin_item", Arguments: map[string]any{"requestId": "douyin-invalid", "text": "https://evil.test"}})
	if err != nil || !invalid.IsError {
		t.Fatal("Douyin input validation bypassed")
	}
	invalid, err = session.CallTool(ctx, &mcp.CallToolParams{Name: "get_douyin_image", Arguments: map[string]any{"requestId": "douyin-invalid-index", "resultId": "douyin-parsed", "index": 0}})
	if err != nil || !invalid.IsError {
		t.Fatal("Douyin index validation bypassed")
	}
	// Large results use bounded HTTP delivery rather than expanding the entire file into MCP JSON.
	large := bytes.Repeat([]byte("x"), 9<<20)
	largeJob, err := service.tasks.Submit("large-result", "x", func(ctx context.Context, dir string) (taskOutput, error) {
		path := filepath.Join(dir, "large.zip")
		err := os.WriteFile(path, large, 0600)
		return taskOutput{File: &FileInfo{Name: "large.zip", MIME: "application/zip", Bytes: int64(len(large)), path: path}}, err
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.tasks.Get(ctx, largeJob.ID, time.Second); err != nil {
		t.Fatal(err)
	}
	meta := call("get_task_result", map[string]any{"jobId": largeJob.ID})
	data, _ := json.Marshal(meta.StructuredContent)
	var info FileInfo
	json.Unmarshal(data, &info)
	if info.DownloadURL == "" {
		t.Fatal("large result lacks download capability")
	}
	response, err = http.Get(info.DownloadURL)
	if err != nil {
		t.Fatal(err)
	}
	got, _ := io.ReadAll(response.Body)
	response.Body.Close()
	if response.StatusCode != 200 || !bytes.Equal(got, large) {
		t.Fatal("large download failed")
	}
	for _, url := range []string{strings.Replace(info.DownloadURL, largeJob.ID, removed.ID, 1), info.DownloadURL + "bad"} {
		response, err := http.Get(url)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != 404 {
			t.Fatal("capability accepted for wrong file/signature")
		}
	}
	response, err = http.Get(host.URL + "/api/mcp/files/" + largeJob.ID)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 404 {
		t.Fatal("download without capability")
	}
}
