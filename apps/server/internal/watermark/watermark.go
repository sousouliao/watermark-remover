package watermark

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/media"
)

type Region struct {
	X1 int `json:"x1"`
	Y1 int `json:"y1"`
	X2 int `json:"x2"`
	Y2 int `json:"y2"`
}

func (r *Region) UnmarshalJSON(data []byte) error {
	var value struct {
		X1 *int `json:"x1"`
		Y1 *int `json:"y1"`
		X2 *int `json:"x2"`
		Y2 *int `json:"y2"`
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		return err
	}
	if value.X1 == nil || value.Y1 == nil || value.X2 == nil || value.Y2 == nil {
		return fmt.Errorf("region requires four integer coordinates")
	}
	r.X1, r.Y1, r.X2, r.Y2 = *value.X1, *value.Y1, *value.X2, *value.Y2
	return nil
}

type Input struct {
	Image  string  `json:"image"`
	Model  string  `json:"model"`
	Mode   string  `json:"mode"`
	Region *Region `json:"region,omitempty"`
}
type Result struct {
	Image string `json:"image"`
	Model string `json:"model"`
}
type Service struct {
	client                *http.Client
	url, key, lite, flash string
}

func New(client *http.Client, key, lite, flash string) *Service {
	return &Service{client, "https://ark.cn-beijing.volces.com/api/v3/images/generations", key, lite, flash}
}

const prompt = "请仅移除图片中后加的水印文字或标识，恢复其下的原照片纹理。保留原照片中的人物、物体和原有文字，不要添加新元素或新文字。尽量保持非水印区域不变。"

// ValidateOptions is shared by the web adapter and asynchronous MCP submission.
func (in Input) ValidateOptions() error {
	if in.Model != "lite" && in.Model != "flash" {
		return httpapi.Fail(400, "请选择 Lite 或 Flash 模型")
	}
	switch in.Mode {
	case "direct":
		if in.Region != nil {
			return httpapi.Fail(400, "直接移除模式不需要区域坐标")
		}
	case "region":
		r := in.Region
		if r == nil || r.X1 < 0 || r.Y1 < 0 || r.X2 > 999 || r.Y2 > 999 || r.X1 >= r.X2 || r.Y1 >= r.Y2 {
			return httpapi.Fail(400, "请提供有效的水印区域坐标")
		}
	default:
		return httpapi.Fail(400, "请选择有效的处理模式")
	}
	return nil
}

func (s *Service) Remove(ctx context.Context, input Input) (Result, error) {
	if _, _, err := media.DecodeDataURL(input.Image); err != nil {
		return Result{}, err
	}
	if err := input.ValidateOptions(); err != nil {
		return Result{}, err
	}
	endpoint := s.lite
	if input.Model == "flash" {
		endpoint = s.flash
	}
	text := prompt
	if input.Mode == "region" {
		r := input.Region
		text = fmt.Sprintf("请仅移除 <bbox>%d %d %d %d</bbox> 区域内后加的水印文字或标识，恢复其下的原照片纹理。区域外保持不变；保留原照片中的人物、物体和原有文字，不要添加新元素或新文字。", r.X1, r.Y1, r.X2, r.Y2)
	}
	if s.key == "" || endpoint == "" {
		return Result{}, httpapi.Fail(503, "图像服务尚未配置，请联系管理员")
	}
	body, _ := json.Marshal(map[string]any{"model": endpoint, "prompt": text, "image": input.Image, "size": "2K", "output_format": "png", "response_format": "b64_json", "watermark": false})
	ctx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "POST", s.url, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+s.key)
	req.Header.Set("Content-Type", "application/json")
	response, err := s.client.Do(req)
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return Result{}, httpapi.Fail(504, "图像服务处理超时，请稍后重试")
		}
		return Result{}, httpapi.Fail(502, "暂时无法连接图像服务")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		switch response.StatusCode {
		case 400, 413, 422:
			return Result{}, httpapi.Fail(400, "图片或区域参数不符合图像服务要求")
		case 429:
			return Result{}, httpapi.Fail(503, "图像服务当前繁忙，请稍后重试")
		case 408, 504:
			return Result{}, httpapi.Fail(504, "图像服务处理超时")
		default:
			return Result{}, httpapi.Fail(502, "图像服务处理失败，请稍后重试")
		}
	}
	var data struct {
		Data []struct {
			Encoded string `json:"b64_json"`
		} `json:"data"`
	}
	if json.NewDecoder(io.LimitReader(response.Body, 45<<20)).Decode(&data) != nil || len(data.Data) == 0 {
		return Result{}, httpapi.Fail(502, "图像服务返回了无效响应")
	}
	b, err := base64.StdEncoding.DecodeString(data.Data[0].Encoded)
	if err != nil || int64(len(b)) > media.MaxImageBytes || media.ImageType(b) != "image/png" {
		return Result{}, httpapi.Fail(502, "图像服务未返回有效图片")
	}
	return Result{"data:image/png;base64," + data.Data[0].Encoded, input.Model}, nil
}

func (s *Service) Handler(w http.ResponseWriter, r *http.Request) {
	var input Input
	if err := httpapi.Decode(w, r, &input, 50<<20); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	result, err := s.Remove(r.Context(), input)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	httpapi.Success(w, result)
}
