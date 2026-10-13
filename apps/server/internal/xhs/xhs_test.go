package xhs

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

const sampleID = "6aa27a5b0000000028034dd9"

type testMedia struct {
	client *http.Client
	url    string
}

func TestConcurrentResultLookup(t *testing.T) {
	s := New(nil)
	s.results["id"] = saved{Note: Note{ID: sampleID, Sources: []string{"https://ci.xiaohongshu.com/image"}}, Expires: time.Now().Add(time.Minute)}
	var group sync.WaitGroup
	for i := 0; i < 20; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			for j := 0; j < 20; j++ {
				note, err := s.result("id")
				if err != nil || note.ID != sampleID {
					t.Error("result unavailable")
				}
			}
		}()
	}
	group.Wait()
}

func (m testMedia) Get(ctx context.Context, address string) (*http.Response, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", m.url+"/"+address[strings.LastIndex(address, "/")+1:], nil)
	return m.client.Do(req)
}

func TestParseAndDownloadFlow(t *testing.T) {
	bad := false
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if r.URL.Path != "/xhs/detail" || body["download"] != false || body["check_record"] != false || len(body) != 3 || !strings.Contains(body["url"].(string), "xsec_token=private") {
			t.Error("wrong parser request")
		}
		if bad {
			fmt.Fprint(w, `{"data":null,"message":"secret upstream content"}`)
			return
		}
		fmt.Fprintf(w, `{"data":{"作品ID":%q,"作品标题":"sample","作品描述":"description","作品类型":"图文","作者昵称":"author","下载地址":["https://ci.xiaohongshu.com/1","https://ci.xiaohongshu.com/2"]},"params":{"cookie":"must-not-leak"}}`, sampleID)
	}))
	defer upstream.Close()
	s := New(NewClient(upstream.Client(), upstream.URL))
	images := map[string][]byte{"/1": []byte("\xff\xd8\xff first image data"), "/2": []byte("\xff\xd8\xff second image data")}
	imageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write(images[r.URL.Path]) }))
	defer imageServer.Close()
	s.media = testMedia{imageServer.Client(), imageServer.URL}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/xhs/parse", s.ParseHandler)
	mux.HandleFunc("GET /api/xhs/results/{id}/images/{index}", s.ImageHandler)
	mux.HandleFunc("GET /api/xhs/results/{id}/archive", s.ArchiveHandler)
	parse := func() *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"text": "分享 https://www.xiaohongshu.com/discovery/item/" + sampleID + "?xsec_token=private"})
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("POST", "/api/xhs/parse", bytes.NewReader(body)))
		return w
	}
	w := parse()
	if w.Code != 200 {
		t.Fatalf("parse %d: %s", w.Code, w.Body)
	}
	if strings.Contains(w.Body.String(), "ci.xiaohongshu.com") || strings.Contains(w.Body.String(), "must-not-leak") || strings.Contains(w.Body.String(), "private") {
		t.Fatal("private source leaked")
	}
	var response struct {
		Data struct {
			ID     string `json:"resultId"`
			Images []any  `json:"images"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &response)
	if len(response.Data.Images) != 2 {
		t.Fatal("incomplete image list")
	}
	base := "/api/xhs/results/" + response.Data.ID
	get := func(path string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		return w
	}
	w = get(base + "/images/1?download=1")
	if w.Code != 200 || !bytes.Equal(w.Body.Bytes(), images["/1"]) || !strings.HasPrefix(w.Header().Get("Content-Disposition"), "attachment") {
		t.Fatal("single image download incorrect")
	}
	w = get(base + "/archive")
	if w.Code != 200 {
		t.Fatalf("archive: %s", w.Body)
	}
	z, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	if err != nil || len(z.File) != 2 {
		t.Fatal("ZIP incomplete")
	}
	for i, f := range z.File {
		reader, _ := f.Open()
		b, _ := io.ReadAll(reader)
		reader.Close()
		if f.Name != fmt.Sprintf("%02d.jpg", i+1) || !bytes.Equal(b, images[fmt.Sprintf("/%d", i+1)]) {
			t.Fatal("ZIP ordering or content changed")
		}
	}
	if get(base+"/images/3").Code != 404 {
		t.Fatal("invalid index accepted")
	}
	images["/2"] = []byte("not an image")
	w = get(base + "/archive")
	if w.Code != 502 || w.Header().Get("Content-Type") == "application/zip" {
		t.Fatal("partial ZIP delivered")
	}
	s.now = func() time.Time { return time.Now().Add(31 * time.Minute) }
	if get(base+"/archive").Code != 410 {
		t.Fatal("expired result accepted")
	}
	bad = true
	w = parse()
	if w.Code != 422 || strings.Contains(w.Body.String(), "secret upstream") {
		t.Fatal("parser failure not mapped safely")
	}
}

func TestShareInput(t *testing.T) {
	for _, value := range []string{"https://evil.test/", "https://www.xiaohongshu.com/user/profile/123", "https://user:password@www.xiaohongshu.com/explore/" + sampleID, "https://www.xiaohongshu.com/explore/" + sampleID + " https://xhslink.com/o/abc"} {
		if _, err := ExtractURL(value); err == nil {
			t.Fatalf("input accepted: %s", value)
		}
	}
	u, err := ExtractURL("标题 https://www.xiaohongshu.com/discovery/item/" + sampleID + "?xsec_token=token&xsec_source=pc_share")
	if err != nil || u.Query().Get("xsec_token") != "token" {
		t.Fatal("share parameters lost")
	}
}
