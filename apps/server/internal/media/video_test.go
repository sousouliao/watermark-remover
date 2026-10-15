package media

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
)

type videoSource struct{ response *http.Response }

func (v videoSource) Get(context.Context, string) (*http.Response, error) { return v.response, nil }

func TestVideoDownloadValidation(t *testing.T) {
	video := []byte("\x00\x00\x00\x18ftypisom original video")
	for _, tt := range []struct {
		name   string
		body   []byte
		length int64
		valid  bool
	}{
		{"mp4", video, int64(len(video)), true},
		{"HTML masquerading as MP4", []byte("<html>error page</html>"), -1, false},
		{"short", []byte("ftyp"), -1, false},
		{"image HEIF", []byte("\x00\x00\x00\x18ftypheic image"), -1, false},
		{"truncated", video, int64(len(video) + 1), false},
		{"oversized header", video, MaxVideoBytes + 1, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			response := &http.Response{Body: io.NopCloser(bytes.NewReader(tt.body)), ContentLength: tt.length}
			file, err := DownloadVideo(context.Background(), videoSource{response}, "https://cdn.test/video")
			if (err == nil) != tt.valid {
				t.Fatalf("validation: %v", err)
			}
			if file != nil {
				defer os.Remove(file.Name())
				defer file.Close()
				file.Seek(0, io.SeekStart)
				data, _ := io.ReadAll(file)
				if !bytes.Equal(data, video) {
					t.Fatal("video bytes changed")
				}
			}
		})
	}
	// Chunked videos over the old 30 MB image limit must remain downloadable.
	response := &http.Response{Body: io.NopCloser(io.MultiReader(bytes.NewReader(video), strings.NewReader(strings.Repeat("x", 31<<20)))), ContentLength: -1}
	file, err := DownloadVideo(context.Background(), videoSource{response}, "https://cdn.test/video")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(file.Name())
	defer file.Close()
	stat, _ := file.Stat()
	if stat.Size() != int64(len(video))+31<<20 {
		t.Fatal("video size changed")
	}
	response = &http.Response{Body: io.NopCloser(io.MultiReader(bytes.NewReader(video), io.LimitReader(zeroReader{}, MaxVideoBytes))), ContentLength: -1}
	if file, err := DownloadVideo(context.Background(), videoSource{response}, "https://cdn.test/video"); err == nil || file != nil {
		t.Fatal("oversized chunked video accepted")
	}
	if NewVideoClient(XHSHost).maxBytes != MaxVideoBytes || NewClient(XHSHost).maxBytes != MaxImageBytes {
		t.Fatal("image and video limits mixed")
	}
}

type zeroReader struct{}

func (zeroReader) Read(b []byte) (int, error) { clear(b); return len(b), nil }
