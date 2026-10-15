package mcpprobe

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"image/png"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func tokenDigest(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}

func TestAuthentication(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	for _, token := range []string{"", "wrong", "old-token", "probe-token"} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "http://localhost/api/mcp", nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		New(tokenDigest("probe-token"), logger).ServeHTTP(w, req)
		want := http.StatusUnauthorized
		if token == "probe-token" {
			want = http.StatusMethodNotAllowed
		}
		if w.Code != want || strings.Contains(w.Header().Get("WWW-Authenticate"), "resource_metadata") {
			t.Fatalf("token %q: status=%d headers=%v", token, w.Code, w.Header())
		}
	}
	for _, digest := range []string{"", "bad-digest"} {
		w := httptest.NewRecorder()
		New(digest, logger).ServeHTTP(w, httptest.NewRequest("POST", "/api/mcp", nil))
		if w.Code != http.StatusNotFound {
			t.Fatal("invalid configuration must disable probe")
		}
	}
}

type bearerTransport struct{ token string }

func (tr bearerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	copy := req.Clone(req.Context())
	copy.Header.Set("Authorization", "Bearer "+tr.token)
	return http.DefaultTransport.RoundTrip(copy)
}

func TestHTTPToolsAndResources(t *testing.T) {
	const token = "test-secret-that-must-not-be-logged"
	var logs bytes.Buffer
	server := httptest.NewServer(New(tokenDigest(token), slog.New(slog.NewTextHandler(&logs, nil))))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client := mcp.NewClient(&mcp.Implementation{Name: "probe-test", Version: "1"}, nil)
	session, err := client.Connect(ctx, &mcp.StreamableClientTransport{
		Endpoint: server.URL, HTTPClient: &http.Client{Transport: bearerTransport{token}},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	tools, err := session.ListTools(ctx, nil)
	if err != nil || len(tools.Tools) != 4 {
		t.Fatalf("tools: %v, %v", tools, err)
	}
	call := func(name string, args any) *mcp.CallToolResult {
		t.Helper()
		result, err := session.CallTool(ctx, &mcp.CallToolParams{Name: name, Arguments: args})
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	if result := call("probe_ping", map[string]any{}); result.IsError {
		t.Fatal(result)
	}
	files := call("probe_test_files", map[string]any{})
	if files.IsError || len(files.Content) != 3 {
		t.Fatalf("test files: %+v", files)
	}
	picture := files.Content[0].(*mcp.ImageContent)
	if _, err := png.Decode(bytes.NewReader(picture.Data)); err != nil {
		t.Fatal(err)
	}
	input := "data:image/png;base64," + base64.StdEncoding.EncodeToString(picture.Data)
	echo := call("probe_echo_image", map[string]any{"image": input})
	if echo.IsError || !bytes.Equal(echo.Content[0].(*mcp.ImageContent).Data, picture.Data) {
		t.Fatal("echo must preserve original bytes")
	}
	encoded, _ := json.Marshal(echo.StructuredContent)
	var info imageInfo
	if err := json.Unmarshal(encoded, &info); err != nil || info.SHA256 != tokenDigest(string(picture.Data)) || info.Bytes != len(picture.Data) {
		t.Fatalf("echo metadata: %s, %v", encoded, err)
	}
	for _, content := range files.Content[1:] {
		link := content.(*mcp.ResourceLink)
		resource, err := session.ReadResource(ctx, &mcp.ReadResourceParams{URI: link.URI})
		if err != nil || len(resource.Contents) != 1 {
			t.Fatalf("resource: %v, %v", resource, err)
		}
		data := resource.Contents[0].Blob
		if link.MIMEType == "image/png" {
			if !bytes.Equal(data, picture.Data) {
				t.Fatal("resource image differs")
			}
		} else {
			archive, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
			if err != nil || len(archive.File) != 2 {
				t.Fatalf("archive: %v, %v", archive, err)
			}
			reader, err := archive.File[0].Open()
			if err != nil {
				t.Fatal(err)
			}
			archivedImage, err := io.ReadAll(reader)
			reader.Close()
			if err != nil || !bytes.Equal(archivedImage, picture.Data) {
				t.Fatal("archive must contain complete image bytes")
			}
		}
	}
	if result := call("probe_wait", map[string]any{"seconds": 0}); result.IsError {
		t.Fatal(result)
	}
	for _, args := range []map[string]any{{"seconds": -1}, {"seconds": 301}} {
		if result := call("probe_wait", args); !result.IsError {
			t.Fatalf("expected rejection of %v", args)
		}
	}
	if result := call("probe_echo_image", map[string]any{"image": "/workspace/image.png"}); !result.IsError {
		t.Fatal("local paths must be rejected")
	}
	for _, method := range []string{"server/discover", "tools/list", "tools/call", "resources/read"} {
		if !strings.Contains(logs.String(), "method="+method) {
			t.Fatalf("missing method log: %s", method)
		}
	}
	if strings.Contains(logs.String(), token) || strings.Contains(logs.String(), input) {
		t.Fatal("logs contain secret or image payload")
	}
}

func TestWaitCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := wait(ctx, nil, 300); err != context.Canceled {
		t.Fatalf("canceled wait: %v", err)
	}
}
