package xhs

import (
	"archive/zip"
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/media"
)

type saved struct {
	Note    Note
	Expires time.Time
	Created time.Time
}
type mediaSource interface {
	Get(context.Context, string) (*http.Response, error)
}
type Service struct {
	client                    *Client
	media                     mediaSource
	mu                        sync.Mutex
	results                   map[string]saved
	parseSlots, downloadSlots chan struct{}
	now                       func() time.Time
}

func New(client *Client) *Service {
	return &Service{client: client, media: media.NewClient(media.XHSHost), results: make(map[string]saved), parseSlots: make(chan struct{}, 1), downloadSlots: make(chan struct{}, 2), now: time.Now}
}

func acquire(slots chan struct{}) error {
	select {
	case slots <- struct{}{}:
		return nil
	default:
		return httpapi.Fail(503, "服务当前繁忙，请稍后重试")
	}
}

type Parsed struct {
	ResultID   string    `json:"resultId"`
	Note       Note      `json:"note"`
	ImageCount int       `json:"imageCount"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

func (s *Service) Parse(ctx context.Context, text string) (Parsed, error) {
	if err := acquire(s.parseSlots); err != nil {
		return Parsed{}, err
	}
	defer func() { <-s.parseSlots }()
	note, err := s.client.Parse(ctx, text)
	if err != nil {
		return Parsed{}, err
	}
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return Parsed{}, err
	}
	id := hex.EncodeToString(random[:])
	now := s.now()
	expires := now.Add(30 * time.Minute)
	s.mu.Lock()
	for key, value := range s.results {
		if !now.Before(value.Expires) {
			delete(s.results, key)
		}
	}
	if len(s.results) >= 50 {
		oldestID := ""
		oldest := now
		for key, value := range s.results {
			if !value.Created.After(oldest) {
				oldestID, oldest = key, value.Created
			}
		}
		delete(s.results, oldestID)
	}
	s.results[id] = saved{note, expires, now}
	s.mu.Unlock()
	return Parsed{ResultID: id, Note: note, ImageCount: len(note.Sources), ExpiresAt: expires}, nil
}

func (s *Service) ParseHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Text string `json:"text"`
	}
	if err := httpapi.Decode(w, r, &input, 16<<10); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	parsed, err := s.Parse(r.Context(), input.Text)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	id, note, expires := parsed.ResultID, parsed.Note, parsed.ExpiresAt
	images := make([]map[string]any, len(note.Sources))
	for i := range images {
		path := fmt.Sprintf("/api/xhs/results/%s/images/%d", id, i+1)
		images[i] = map[string]any{"index": i + 1, "previewUrl": path, "downloadUrl": path + "?download=1"}
	}
	httpapi.Success(w, map[string]any{"resultId": id, "note": note, "images": images, "zipUrl": "/api/xhs/results/" + id + "/archive", "expiresAt": expires.UTC().Format(time.RFC3339)})
}

func (s *Service) result(id string) (Note, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	value, ok := s.results[id]
	if !ok || !s.now().Before(value.Expires) {
		delete(s.results, id)
		return Note{}, httpapi.Fail(410, "解析结果已失效，请重新解析")
	}
	return value.Note, nil
}

func extension(kind string) string {
	return map[string]string{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[kind]
}

// copyImage checks the signature and counts actual streamed bytes, regardless of headers.
func (s *Service) copyImage(ctx context.Context, address string, destination func(string) (io.Writer, error)) (int64, string, error) {
	response, err := s.media.Get(ctx, address)
	if err != nil {
		return 0, "", err
	}
	defer response.Body.Close()
	reader := bufio.NewReader(response.Body)
	head, err := reader.Peek(12)
	if err != nil {
		return 0, "", httpapi.Fail(502, "图片资源不完整")
	}
	kind := media.ImageType(head)
	if kind == "" {
		return 0, "", httpapi.Fail(502, "资源不是有效图片")
	}
	writer, err := destination(kind)
	if err != nil {
		return 0, "", err
	}
	n, err := io.Copy(writer, io.LimitReader(reader, media.MaxImageBytes+1))
	if err != nil {
		return 0, "", httpapi.Fail(502, "图片下载失败")
	}
	if n > media.MaxImageBytes {
		return 0, "", httpapi.Fail(502, "图片超过 30 MB 限制")
	}
	return n, kind, nil
}

// Image downloads a complete image. The caller closes and removes the returned file.
func (s *Service) Image(ctx context.Context, id string, index int) (*os.File, string, string, error) {
	note, err := s.result(id)
	if err != nil {
		return nil, "", "", err
	}
	if index < 1 || index > len(note.Sources) {
		return nil, "", "", httpapi.Fail(404, "图片不存在")
	}
	if err := acquire(s.downloadSlots); err != nil {
		return nil, "", "", err
	}
	defer func() { <-s.downloadSlots }()
	file, err := os.CreateTemp("", "watermark-image-*")
	if err != nil {
		return nil, "", "", err
	}
	_, kind, err := s.copyImage(ctx, note.Sources[index-1], func(string) (io.Writer, error) { return file, nil })
	if err != nil {
		file.Close()
		os.Remove(file.Name())
		return nil, "", "", err
	}
	return file, kind, fmt.Sprintf("%s-%02d.%s", note.ID, index, extension(kind)), nil
}

func (s *Service) ImageHandler(w http.ResponseWriter, r *http.Request) {
	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		httpapi.WriteError(w, httpapi.Fail(404, "图片不存在"))
		return
	}
	file, kind, name, err := s.Image(r.Context(), r.PathValue("id"), index)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	defer os.Remove(file.Name())
	defer file.Close()
	disposition := "inline"
	if r.URL.Query().Get("download") == "1" {
		disposition = "attachment"
	}
	w.Header().Set("Content-Type", kind)
	w.Header().Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": name}))
	w.Header().Set("Cache-Control", "no-store")
	http.ServeContent(w, r, name, time.Time{}, file)
}

func (s *Service) Archive(ctx context.Context, id string) (*os.File, string, error) {
	note, err := s.result(id)
	if err != nil {
		return nil, "", err
	}
	if err := acquire(s.downloadSlots); err != nil {
		return nil, "", err
	}
	defer func() { <-s.downloadSlots }()
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	file, err := os.CreateTemp("", "watermark-archive-*.zip")
	if err != nil {
		return nil, "", err
	}
	complete := false
	defer func() {
		if !complete {
			file.Close()
			os.Remove(file.Name())
		}
	}()
	archive := zip.NewWriter(file)
	var total int64
	for i, address := range note.Sources {
		n, _, err := s.copyImage(ctx, address, func(kind string) (io.Writer, error) {
			return archive.CreateHeader(&zip.FileHeader{Name: fmt.Sprintf("%02d.%s", i+1, extension(kind)), Method: zip.Store})
		})
		if err != nil {
			_ = archive.Close()
			return nil, "", err
		}
		total += n
		if total > 150<<20 {
			_ = archive.Close()
			return nil, "", httpapi.Fail(502, "图集超过 150 MB 下载限制")
		}
	}
	if err := archive.Close(); err != nil {
		return nil, "", err
	}
	complete = true
	return file, note.ID + ".zip", nil
}

func (s *Service) ArchiveHandler(w http.ResponseWriter, r *http.Request) {
	file, name, err := s.Archive(r.Context(), r.PathValue("id"))
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	defer os.Remove(file.Name())
	defer file.Close()
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
	w.Header().Set("Cache-Control", "no-store")
	http.ServeContent(w, r, name, time.Time{}, file)
}
