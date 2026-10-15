package douyin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
)

func status(err error) int {
	var e *httpapi.Error
	if errors.As(err, &e) {
		return e.Status
	}
	return 0
}

func TestShareInput(t *testing.T) {
	for _, tt := range []struct {
		text  string
		valid bool
	}{
		{"分享 https://v.douyin.com/Ab_123/。", true},
		{"http://WWW.DOUYIN.COM/note/" + sampleID + "?x=1#fragment", true},
		{"https://www.iesdouyin.com/share/video/" + sampleID + "/", true},
		{"https://www.douyin.com/slides/" + sampleID, true},
		{"https://www.douyin.com/user/abc?modal_id=" + sampleID, true},
		{"https://evil.test/note/" + sampleID, false},
		{"https://www.douyin.com.evil.test/note/" + sampleID, false},
		{"https://user:secret@www.douyin.com/note/" + sampleID, false},
		{"https://www.douyin.com:8080/note/" + sampleID, false},
		{"https://v.douyin.com/abc/ https://www.douyin.com/note/" + sampleID, false},
		{"https://www.douyin.com/user/abc", false},
		{"https://www.douyin.com/note/123", false},
		{"https://v.douyin.com/", false},
		{strings.Repeat("x", 8193), false},
	} {
		t.Run(tt.text[:min(len(tt.text), 80)], func(t *testing.T) {
			u, err := ExtractURL(tt.text)
			if (err == nil) != tt.valid {
				t.Fatalf("URL validation: %v", err)
			}
			if err == nil && (u.Scheme != "https" || u.Fragment != "") {
				t.Fatal("URL not normalized")
			}
		})
	}
}

func TestImageAllowlist(t *testing.T) {
	for _, tt := range []struct {
		host  string
		valid bool
	}{
		{"p3-sign.douyinpic.com", true}, {"p9.douyinpic.com", true},
		{"douyinpic.com", false}, {"evildouyinpic.com", false},
		{"p3.douyinpic.com.evil.test", false}, {"127.0.0.1", false}, {"v.douyinvod.com", false},
	} {
		if imageHost(tt.host) != tt.valid {
			t.Errorf("host %s", tt.host)
		}
	}
}

func TestClientContract(t *testing.T) {
	for _, tt := range []struct {
		name, data string
		code       int
	}{
		{"images", fmt.Sprintf(`{"id":%q,"type":"图集","desc":"title","nickname":"author","downloads":["https://p3-sign.douyinpic.com/a"]}`, sampleID), 0},
		{"video", fmt.Sprintf(`{"id":%q,"type":"视频","downloads":"https://video.test/a"}`, sampleID), 502},
		{"live photo", fmt.Sprintf(`{"id":%q,"type":"实况","downloads":[["image","video"]]}`, sampleID), 422},
		{"unknown type", fmt.Sprintf(`{"id":%q,"type":"other"}`, sampleID), 422},
		{"missing", "null", 422},
		{"wrong id", `{"id":"other","type":"图集"}`, 502},
		{"bad downloads", fmt.Sprintf(`{"id":%q,"type":"图集","downloads":"url"}`, sampleID), 502},
		{"empty", fmt.Sprintf(`{"id":%q,"type":"图集","downloads":[]}`, sampleID), 502},
	} {
		t.Run(tt.name, func(t *testing.T) {
			calls := 0
			host := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				var in map[string]any
				json.NewDecoder(r.Body).Decode(&in)
				if r.Method != "POST" || r.Header.Get("Cookie") != "" {
					t.Error("unsafe request")
				}
				if r.URL.Path == "/douyin/share" {
					if len(in) != 1 || in["text"] != "https://v.douyin.com/Abc/" {
						t.Error("share body")
					}
					fmt.Fprintf(w, `{"url":"https://www.iesdouyin.com/share/note/%s/"}`, sampleID)
				} else {
					if r.URL.Path != "/douyin/detail" || len(in) != 2 || in["detail_id"] != sampleID || in["source"] != false {
						t.Error("detail body")
					}
					fmt.Fprintf(w, `{"data":%s,"params":{"cookie":"secret"}}`, tt.data)
				}
			}))
			defer host.Close()
			item, err := NewClient(host.Client(), host.URL).Parse(context.Background(), "share https://v.douyin.com/Abc/")
			if status(err) != tt.code || (tt.code == 0 && err != nil) {
				t.Fatalf("result: %+v %v", item, err)
			}
			if calls != 2 {
				t.Fatal("short-link flow not used")
			}
			if err == nil && (item.Title != "title" || item.AuthorName != "author" || len(item.Sources) != 1) {
				t.Fatal("mapping")
			}
		})
	}
}

func TestClientFailures(t *testing.T) {
	for _, tt := range []struct {
		name, body     string
		upstream, code int
	}{
		{"http failure", "secret cookie", 500, 502},
		{"redirect", "", 302, 502},
		{"invalid JSON", "secret", 200, 502},
		{"oversized", strings.Repeat(" ", 1<<20) + `{}`, 200, 502},
		{"bad share", `{"url":"https://127.0.0.1/private"}`, 200, 422},
		{"null share", `{"url":null}`, 200, 422},
	} {
		t.Run(tt.name, func(t *testing.T) {
			host := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(tt.upstream); fmt.Fprint(w, tt.body) }))
			defer host.Close()
			_, err := NewClient(host.Client(), host.URL).Parse(context.Background(), "https://v.douyin.com/abc/")
			if status(err) != tt.code || strings.Contains(err.Error(), "secret") {
				t.Fatalf("error: %v", err)
			}
		})
	}
	_, err := NewClient(http.DefaultClient, "http://example.com").Parse(context.Background(), "https://www.douyin.com/note/"+sampleID)
	if status(err) != 503 {
		t.Fatal("external upstream accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = NewClient(http.DefaultClient, "http://127.0.0.1:1").Parse(ctx, "https://www.douyin.com/note/"+sampleID)
	if status(err) != 504 {
		t.Fatalf("cancellation: %v", err)
	}
}

func TestImageAddresses(t *testing.T) {
	for _, address := range []string{
		"http://p3-sign.douyinpic.com/a", "https://p3-sign.douyinpic.com:8080/a",
		"https://user:secret@p3-sign.douyinpic.com/a", "https://127.0.0.1/a",
		"https://p3-sign.douyinpic.com.evil.test/a", "https://evil.test/a", "",
	} {
		t.Run(address, func(t *testing.T) {
			host := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				fmt.Fprintf(w, `{"data":{"id":%q,"type":"图集","downloads":[%q]}}`, sampleID, address)
			}))
			defer host.Close()
			_, err := NewClient(host.Client(), host.URL).Parse(context.Background(), "https://www.douyin.com/note/"+sampleID)
			if status(err) != 502 {
				t.Fatalf("unsafe image address accepted: %v", err)
			}
		})
	}
}

func TestVideoAllowlist(t *testing.T) {
	for host, valid := range map[string]bool{
		"v3.douyinvod.com": true, "v26-web.douyinvod.com": true,
		"douyinvod.com": false, "evildouyinvod.com": false,
		"v3.douyinvod.com.evil.test": false, "127.0.0.1": false,
		"p3.douyinpic.com": false,
	} {
		if videoHost(host) != valid {
			t.Errorf("video host %s", host)
		}
	}
}
