package douyin

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
)

type Item struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	AuthorName  string   `json:"authorName"`
	Sources     []string `json:"-"`
	VideoSource string   `json:"-"`
}

type Client struct {
	http *http.Client
	base string
}

func NewClient(client *http.Client, base string) *Client {
	copy := *client
	copy.Jar = nil
	copy.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return &Client{http: &copy, base: strings.TrimRight(base, "/")}
}

func (c *Client) post(ctx context.Context, path string, input, output any) error {
	// Validate here as well as in config so other entry points cannot bypass it.
	u, err := url.Parse(c.base)
	if err != nil || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" || (u.Scheme != "http" && u.Scheme != "https") {
		return httpapi.Fail(503, "抖音解析服务配置无效")
	}
	ip, err := netip.ParseAddr(u.Hostname())
	if err != nil || !ip.IsLoopback() {
		return httpapi.Fail(503, "抖音解析服务必须位于本机")
	}
	body, err := json.Marshal(input)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.base+path, bytes.NewReader(body))
	if err != nil {
		return httpapi.Fail(503, "抖音解析服务配置无效")
	}
	req.Header.Set("Content-Type", "application/json")
	response, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return httpapi.Fail(504, "作品解析超时，请稍后重试")
		}
		return httpapi.Fail(502, "暂时无法连接抖音解析服务")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return httpapi.Fail(502, "抖音解析服务当前不可用")
	}
	b, err := io.ReadAll(io.LimitReader(response.Body, (1<<20)+1))
	if err != nil || len(b) > 1<<20 || json.Unmarshal(b, output) != nil {
		return httpapi.Fail(502, "抖音解析服务返回了无效响应")
	}
	return nil
}

func (c *Client) Parse(ctx context.Context, text string) (Item, error) {
	u, err := ExtractURL(text)
	if err != nil {
		return Item{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	if u.Hostname() == "v.douyin.com" {
		var share struct {
			URL string `json:"url"`
		}
		// Pass only the validated URL, never arbitrary paste text, Cookie or proxy.
		if err := c.post(ctx, "/douyin/share", map[string]string{"text": u.String()}, &share); err != nil {
			return Item{}, err
		}
		u, err = ExtractURL(share.URL)
		if err != nil || itemID(u) == "" {
			return Item{}, httpapi.Fail(422, "分享链接未指向可访问作品，请重新复制")
		}
	}
	id := itemID(u)
	// DouK 5.8 normalized data (source=false), not raw aweme_detail or XHS fields.
	var result struct {
		Data *struct {
			ID          string          `json:"id"`
			Description string          `json:"desc"`
			Author      string          `json:"nickname"`
			Type        string          `json:"type"`
			Downloads   json.RawMessage `json:"downloads"`
		} `json:"data"`
	}
	if err := c.post(ctx, "/douyin/detail", map[string]any{"detail_id": id, "source": false}, &result); err != nil {
		return Item{}, err
	}
	d := result.Data
	if d == nil || d.ID == "" {
		return Item{}, httpapi.Fail(422, "无法解析这条作品，请重新复制分享链接或检查访问限制")
	}
	if d.ID != id {
		return Item{}, httpapi.Fail(502, "作品解析结果与链接不匹配")
	}
	item := Item{ID: d.ID, Title: d.Description, Description: d.Description, AuthorName: d.Author}
	if d.Type == "视频" {
		var address string
		if json.Unmarshal(d.Downloads, &address) != nil {
			return Item{}, httpapi.Fail(502, "作品返回了无效视频")
		}
		u, err := url.Parse(address)
		if err != nil || u.Scheme != "https" || u.User != nil || (u.Port() != "" && u.Port() != "443") || !videoHost(strings.ToLower(u.Hostname())) {
			return Item{}, httpapi.Fail(502, "作品返回了无效视频地址")
		}
		item.VideoSource = address
		return item, nil
	}
	if d.Type != "图集" {
		return Item{}, httpapi.Fail(422, "暂不支持实况或其他作品类型")
	}
	var images []string
	if json.Unmarshal(d.Downloads, &images) != nil || len(images) == 0 || len(images) > 80 {
		return Item{}, httpapi.Fail(502, "作品返回了无效图集")
	}
	for _, value := range images {
		u, err := url.Parse(value)
		if err != nil || u.Scheme != "https" || u.User != nil || (u.Port() != "" && u.Port() != "443") || !imageHost(strings.ToLower(u.Hostname())) {
			return Item{}, httpapi.Fail(502, "作品返回了无效图片地址")
		}
	}
	item.Sources = images
	return item, nil
}
