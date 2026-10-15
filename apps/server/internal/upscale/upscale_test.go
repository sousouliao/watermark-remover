package upscale

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeImage struct{ address string }

func (f *fakeImage) ReadImage(_ context.Context, address string) ([]byte, string, error) {
	f.address = address
	return []byte("\x89PNG\r\n\x1a\nresult"), "image/png", nil
}

func TestGradioUploadCallAndEvent(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/upload":
			if err := r.ParseMultipartForm(1 << 20); err != nil {
				t.Error(err)
			}
			file, _, err := r.FormFile("files")
			if err != nil {
				t.Error("upload missing file")
			} else {
				file.Close()
			}
			if r.MultipartForm != nil {
				defer r.MultipartForm.RemoveAll()
			}
			fmt.Fprint(w, `["/tmp/gradio/input.png"]`)
		case "/call/predict":
			var body struct {
				Data []json.RawMessage `json:"data"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			if len(body.Data) != 2 || string(body.Data[1]) != "2" || !strings.Contains(string(body.Data[0]), "gradio.FileData") {
				t.Error("wrong predict arguments")
			}
			fmt.Fprint(w, `{"event_id":"job"}`)
		case "/call/predict/job":
			fmt.Fprint(w, "event: heartbeat\ndata: null\n\nevent: complete\ndata: [{\"path\":\"/tmp/gradio/result.png\",\"url\":\"/c/file=/tmp/gradio/result.png\"}]\n\n")
		default:
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer upstream.Close()
	s := New(upstream.Client())
	s.base = upstream.URL
	image := &fakeImage{}
	s.media = image
	result, err := s.Enhance(context.Background(), Input{Image: "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("\x89PNG\r\n\x1a\ninput"))})
	if err != nil || !strings.HasPrefix(result, "data:image/png;base64,") || image.address != upstream.URL+"/file=/tmp/gradio/result.png" {
		t.Fatalf("wrong result %q %v", result, err)
	}
	if address, err := readResult(strings.NewReader("event: complete\ndata: [{\"url\":\"/file=/tmp/gradio/url-only.png\"}]\n\n")); err != nil || address != "/file=/tmp/gradio/url-only.png" {
		t.Fatalf("URL-only result: %q %v", address, err)
	}
	for _, events := range []string{"event: error\ndata: secret\n\n", "event: complete\ndata: []\n\n", "event: heartbeat\ndata: null\n\n"} {
		if _, err := readResult(strings.NewReader(events)); err == nil {
			t.Fatal("invalid task accepted")
		}
	}
}
