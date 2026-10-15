package douyin

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

const sampleID = "7561234567890123456"

type testMedia struct {
	client *http.Client
	url    string
}

func TestConcurrentResultLookup(t *testing.T) {
	s := New(nil)
	s.results["id"] = saved{Item: Item{ID: sampleID, Sources: []string{"https://p3-sign.douyinpic.com/image"}}, Expires: time.Now().Add(time.Minute)}
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
		if r.URL.Path != "/douyin/detail" || body["detail_id"] != sampleID || body["source"] != false || len(body) != 2 || r.Header.Get("Cookie") != "" {
			t.Error("wrong parser request")
		}
		if bad {
			fmt.Fprint(w, `{"data":null,"message":"secret upstream content"}`)
			return
		}
		fmt.Fprintf(w, `{"data":{"id":%q,"desc":"description","type":"图集","nickname":"author","downloads":["https://p3-sign.douyinpic.com/1","https://p3-sign.douyinpic.com/2"]},"params":{"cookie":"must-not-leak"}}`, sampleID)
	}))
	defer upstream.Close()
	s := New(NewClient(upstream.Client(), upstream.URL))
	images := map[string][]byte{"/1": []byte("\xff\xd8\xff first image data"), "/2": []byte("\xff\xd8\xff second image data")}
	imageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write(images[r.URL.Path]) }))
	defer imageServer.Close()
	s.media = testMedia{imageServer.Client(), imageServer.URL}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/douyin/parse", s.ParseHandler)
	mux.HandleFunc("GET /api/douyin/results/{id}/images/{index}", s.ImageHandler)
	mux.HandleFunc("GET /api/douyin/results/{id}/archive", s.ArchiveHandler)
	parse := func() *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"text": "分享 https://www.douyin.com/note/" + sampleID + "?share_token=private"})
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("POST", "/api/douyin/parse", bytes.NewReader(body)))
		return w
	}
	w := parse()
	if w.Code != 200 {
		t.Fatalf("parse %d: %s", w.Code, w.Body)
	}
	if strings.Contains(w.Body.String(), "p3-sign.douyinpic.com") || strings.Contains(w.Body.String(), "must-not-leak") || strings.Contains(w.Body.String(), "private") {
		t.Fatal("private source leaked")
	}
	var response struct {
		Data struct {
			ID        string `json:"resultId"`
			MediaType string `json:"mediaType"`
			Item      Item   `json:"item"`
			Images    []any  `json:"images"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &response)
	if len(response.Data.Images) != 2 || response.Data.MediaType != "images" || response.Data.Item.ID != sampleID {
		t.Fatal("incomplete image list")
	}
	base := "/api/douyin/results/" + response.Data.ID
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

func TestCacheAndSlots(t *testing.T) {
	host := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"data":{"id":%q,"type":"图集","downloads":["https://p3-sign.douyinpic.com/a"]}}`, sampleID)
	}))
	defer host.Close()
	s := New(NewClient(host.Client(), host.URL))
	now := time.Now()
	s.now = func() time.Time { return now }
	s.results["expired"] = saved{Expires: now}
	for i := 0; i < 50; i++ {
		created := now.Add(time.Duration(i-50) * time.Second)
		s.results[fmt.Sprint(i)] = saved{Created: created, Expires: now.Add(time.Minute)}
	}
	parsed, err := s.Parse(context.Background(), "https://www.douyin.com/note/"+sampleID)
	if err != nil || len(s.results) != 50 || !parsed.ExpiresAt.Equal(now.Add(30*time.Minute)) {
		t.Fatalf("cache bounds: %v", err)
	}
	if _, ok := s.results["expired"]; ok {
		t.Fatal("expired entry retained")
	}
	if _, ok := s.results["0"]; ok {
		t.Fatal("oldest entry retained")
	}
	s.parseSlots <- struct{}{}
	_, err = s.Parse(context.Background(), "https://www.douyin.com/note/"+sampleID)
	if status(err) != 503 {
		t.Fatalf("parse concurrency: %v", err)
	}
	<-s.parseSlots
	s.downloadSlots <- struct{}{}
	s.downloadSlots <- struct{}{}
	_, _, _, err = s.Image(context.Background(), parsed.ResultID, 1)
	if status(err) != 503 {
		t.Fatalf("download concurrency: %v", err)
	}
	<-s.downloadSlots
	<-s.downloadSlots
	for _, body := range []string{`{"text":"https://v.douyin.com/abc/","cookie":"secret"}`, `{"text":"a"} {}`} {
		w := httptest.NewRecorder()
		s.ParseHandler(w, httptest.NewRequest("POST", "/api/douyin/parse", strings.NewReader(body)))
		if w.Code != 400 {
			t.Fatal("invalid input accepted")
		}
	}
}
