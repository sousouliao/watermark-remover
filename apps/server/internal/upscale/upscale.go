package upscale

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/media"
)

const spaceURL = "https://nick088-real-esrgan-pytorch.hf.space"

type imageReader interface {
	ReadImage(context.Context, string) ([]byte, string, error)
}
type Service struct {
	client *http.Client
	base   string
	media  imageReader
}

func New(client *http.Client) *Service {
	return &Service{client, spaceURL, media.NewClient(func(host string) bool { return host == "nick088-real-esrgan-pytorch.hf.space" })}
}

type Input struct {
	Image string `json:"image"`
	Scale int    `json:"scale,omitempty"`
}

func (s *Service) Enhance(ctx context.Context, input Input) (string, error) {
	image, kind, err := media.DecodeDataURL(input.Image)
	if err != nil {
		return "", err
	}
	if input.Scale == 0 {
		input.Scale = 2
	}
	if input.Scale != 2 && input.Scale != 4 && input.Scale != 8 {
		return "", httpapi.Fail(400, "放大倍数必须为 2、4 或 8")
	}
	ctx, cancel := context.WithTimeout(ctx, 180*time.Second)
	defer cancel()
	var body bytes.Buffer
	upload := multipart.NewWriter(&body)
	ext := map[string]string{"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[kind]
	part, err := upload.CreateFormFile("files", "input."+ext)
	if err != nil {
		return "", err
	}
	if _, err = part.Write(image); err != nil {
		return "", err
	}
	if err = upload.Close(); err != nil {
		return "", err
	}
	response, err := s.request(ctx, "POST", "/upload", &body, upload.FormDataContentType())
	if err != nil {
		return "", err
	}
	var paths []string
	err = json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&paths)
	response.Body.Close()
	if err != nil || len(paths) != 1 || paths[0] == "" {
		return "", httpapi.Fail(502, "图片放大服务上传失败")
	}
	payload, _ := json.Marshal(map[string]any{"data": []any{map[string]any{"path": paths[0], "orig_name": "input." + ext, "meta": map[string]string{"_type": "gradio.FileData"}}, input.Scale}})
	response, err = s.request(ctx, "POST", "/call/predict", bytes.NewReader(payload), "application/json")
	if err != nil {
		return "", err
	}
	var event struct {
		ID string `json:"event_id"`
	}
	err = json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&event)
	response.Body.Close()
	if err != nil || event.ID == "" {
		return "", httpapi.Fail(502, "图片放大服务未接受任务")
	}
	response, err = s.request(ctx, "GET", "/call/predict/"+url.PathEscape(event.ID), nil, "")
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	output, err := readResult(response.Body)
	if err != nil {
		return "", err
	}
	resource, err := url.Parse(output)
	if err != nil {
		return "", httpapi.Fail(502, "图片放大服务返回了无效资源")
	}
	base, _ := url.Parse(s.base)
	resource = base.ResolveReference(resource)
	b, contentType, err := s.media.ReadImage(ctx, resource.String())
	if err != nil {
		return "", err
	}
	return "data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(b), nil
}

func (s *Service) request(ctx context.Context, method, path string, body io.Reader, contentType string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, s.base+path, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	response, err := s.client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return nil, httpapi.Fail(504, "图片放大等待超时或已取消")
		}
		return nil, httpapi.Fail(502, "暂时无法连接图片放大服务")
	}
	if response.StatusCode != 200 {
		response.Body.Close()
		return nil, httpapi.Fail(502, "图片放大服务当前不可用")
	}
	return response, nil
}

func readResult(reader io.Reader) (string, error) {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 4096), 1<<20)
	event := ""
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "event:") {
			event = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		}
		if event == "error" {
			return "", httpapi.Fail(502, "图片放大任务失败")
		}
		if event == "complete" && strings.HasPrefix(line, "data:") {
			var files []struct {
				URL  string `json:"url"`
				Path string `json:"path"`
			}
			if json.Unmarshal([]byte(strings.TrimSpace(strings.TrimPrefix(line, "data:"))), &files) != nil || len(files) == 0 {
				return "", httpapi.Fail(502, "图片放大服务返回了无效结果")
			}
			if files[0].URL != "" {
				return files[0].URL, nil
			}
			if files[0].Path != "" {
				return "/file=" + files[0].Path, nil
			}
		}
	}
	return "", httpapi.Fail(502, "图片放大任务未返回图片")
}

func (s *Service) Handler(w http.ResponseWriter, r *http.Request) {
	var input Input
	if err := httpapi.Decode(w, r, &input, 50<<20); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	image, err := s.Enhance(r.Context(), input)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.Success(w, map[string]string{"image": image})
}
