package media

import (
	"bufio"
	"context"
	"io"
	"mime"
	"net/http"
	"os"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
)

const MaxVideoBytes int64 = 150 << 20

type Source interface {
	Get(context.Context, string) (*http.Response, error)
}

func NewVideoClient(allowed func(string) bool) *Client {
	c := NewClient(allowed)
	c.maxBytes = MaxVideoBytes
	c.client.Timeout = 5 * time.Minute
	return c
}

// DownloadVideo spools the original MP4 to disk; callers only receive complete files.
// MP4/ISO-BMFF uses an ftyp box, rather than trusting the upstream Content-Type.
func DownloadVideo(ctx context.Context, source Source, address string) (*os.File, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	response, err := source.Get(ctx, address)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.ContentLength > MaxVideoBytes {
		return nil, httpapi.Fail(502, "视频超过 150 MB 限制")
	}
	reader := bufio.NewReader(response.Body)
	head, err := reader.Peek(12)
	if err != nil || !isMP4(head) {
		return nil, httpapi.Fail(502, "资源不是有效 MP4 视频")
	}
	file, err := os.CreateTemp("", "watermark-video-*.mp4")
	if err != nil {
		return nil, err
	}
	complete := false
	defer func() {
		if !complete {
			file.Close()
			os.Remove(file.Name())
		}
	}()
	n, err := io.Copy(file, io.LimitReader(reader, MaxVideoBytes+1))
	if err != nil || (response.ContentLength >= 0 && n != response.ContentLength) {
		return nil, httpapi.Fail(502, "视频下载失败或资源不完整")
	}
	if n > MaxVideoBytes {
		return nil, httpapi.Fail(502, "视频超过 150 MB 限制")
	}
	complete = true
	return file, nil
}

// ServeVideo supports authenticated preview (including Range) and file download.
func ServeVideo(w http.ResponseWriter, r *http.Request, file *os.File, name string) {
	defer os.Remove(file.Name())
	defer file.Close()
	disposition := "inline"
	if r.URL.Query().Get("download") == "1" {
		disposition = "attachment"
	}
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": name}))
	w.Header().Set("Cache-Control", "no-store")
	http.ServeContent(w, r, name, time.Time{}, file)
}

func isMP4(head []byte) bool {
	if len(head) < 12 || string(head[4:8]) != "ftyp" {
		return false
	}
	switch string(head[8:12]) {
	case "isom", "iso2", "iso5", "iso6", "mp41", "mp42", "avc1", "dash":
		return true
	default:
		return false
	}
}
