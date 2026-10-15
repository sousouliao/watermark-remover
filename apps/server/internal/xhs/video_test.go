package xhs

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestVideoParseAndDownload(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"data":{"作品ID":%q,"作品类型":"视频","下载地址":["https://sns-video-bd.xhscdn.com/video"]}}`, sampleID)
	}))
	defer upstream.Close()
	payload := []byte("\x00\x00\x00\x18ftypisom original video bytes")
	cdn := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write(payload) }))
	defer cdn.Close()
	service := New(NewClient(upstream.Client(), upstream.URL))
	service.videoMedia = testMedia{cdn.Client(), cdn.URL}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /parse", service.ParseHandler)
	mux.HandleFunc("GET /results/{id}/video", service.VideoHandler)
	body, _ := json.Marshal(map[string]string{"text": "https://www.xiaohongshu.com/explore/" + sampleID})
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest("POST", "/parse", bytes.NewReader(body)))
	if response.Code != 200 {
		t.Fatalf("parse: %d %s", response.Code, response.Body)
	}
	var parsed struct {
		Data struct {
			ResultID  string
			MediaType string
			Images    []any
			Video     map[string]string
			ZipURL    string
		}
	}
	if err := json.Unmarshal(response.Body.Bytes(), &parsed); err != nil {
		t.Fatal(err)
	}
	data := parsed.Data
	if data.MediaType != "video" || len(data.Images) != 0 || data.Video["downloadUrl"] == "" || data.ZipURL != "" || strings.Contains(response.Body.String(), "cdn.com") {
		t.Fatalf("video response: %s", response.Body)
	}
	path := "/results/" + data.ResultID + "/video"
	for _, ranged := range []bool{false, true} {
		req := httptest.NewRequest("GET", path+"?download=1", nil)
		expected, code := payload, 200
		if ranged {
			req.Header.Set("Range", "bytes=4-11")
			expected, code = payload[4:12], 206
		}
		response = httptest.NewRecorder()
		mux.ServeHTTP(response, req)
		if response.Code != code || response.Header().Get("Content-Type") != "video/mp4" || !bytes.Equal(response.Body.Bytes(), expected) || !strings.HasPrefix(response.Header().Get("Content-Disposition"), "attachment") {
			t.Fatalf("video download: %d %s", response.Code, response.Body)
		}
	}
	if file, _, _, err := service.Image(context.Background(), data.ResultID, 1); err == nil || file != nil {
		t.Fatal("video accepted as image")
	}
	if file, _, err := service.Archive(context.Background(), data.ResultID); err == nil || file != nil {
		t.Fatal("video accepted as image ZIP")
	}
	service.results["images"] = saved{Note: Note{ID: sampleID, Sources: []string{"image"}}, Expires: time.Now().Add(time.Minute)}
	if file, _, _, err := service.Video(context.Background(), "images"); err == nil || file != nil {
		t.Fatal("image accepted as video")
	}
	service.now = func() time.Time { return time.Now().Add(31 * time.Minute) }
	response = httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest("GET", path, nil))
	if response.Code != 410 {
		t.Fatal("expired video accepted")
	}
}
