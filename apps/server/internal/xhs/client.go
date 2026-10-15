package xhs

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/media"
)

type Note struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	AuthorName  string   `json:"authorName"`
	Sources     []string `json:"-"`
	VideoSource string   `json:"-"`
}
type Client struct {
	http  *http.Client
	base  string
	pages *media.Client
}

func NewClient(client *http.Client, base string) *Client {
	return &Client{client, base, media.NewClient(media.PageHost)}
}

var links = regexp.MustCompile(`https?://[^\s<>"“”]+`)
var noteID = regexp.MustCompile(`/(?:explore|discovery/item|user/profile/[^/]+)/([a-f0-9]{24})$`)

func ExtractURL(text string) (*url.URL, error) {
	if len(text) > 8192 {
		return nil, httpapi.Fail(400, "分享内容过长")
	}
	var selected *url.URL
	for _, value := range links.FindAllString(text, -1) {
		value = strings.TrimRight(value, "，。！；、）)]}")
		u, err := url.Parse(value)
		if err != nil || !media.PageHost(strings.ToLower(u.Hostname())) {
			continue
		}
		if u.User != nil || (u.Port() != "" && u.Port() != "443" && u.Port() != "80") || (u.Scheme != "http" && u.Scheme != "https") {
			return nil, httpapi.Fail(400, "分享链接无效")
		}
		if selected != nil {
			return nil, httpapi.Fail(400, "每次仅支持一个小红书链接")
		}
		u.Fragment = ""
		u.Scheme = "https"
		u.Host = u.Hostname()
		selected = u
	}
	if selected == nil {
		return nil, httpapi.Fail(400, "未找到有效的小红书分享链接")
	}
	if selected.Hostname() != "xhslink.com" && selected.Hostname() != "www.xhslink.com" && !noteID.MatchString(selected.Path) {
		return nil, httpapi.Fail(400, "仅支持公开笔记分享链接")
	}
	return selected, nil
}

func (c *Client) Parse(ctx context.Context, text string) (Note, error) {
	u, err := ExtractURL(text)
	if err != nil {
		return Note{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	if u.Hostname() == "xhslink.com" || u.Hostname() == "www.xhslink.com" {
		response, err := c.pages.Get(ctx, u.String())
		if err != nil {
			return Note{}, err
		}
		u = response.Request.URL
		response.Body.Close()
		if !noteID.MatchString(u.Path) {
			return Note{}, httpapi.Fail(422, "分享链接未指向可访问笔记，请重新复制")
		}
	}
	body, _ := json.Marshal(map[string]any{"url": u.String(), "download": false, "check_record": false})
	req, err := http.NewRequestWithContext(ctx, "POST", c.base+"/xhs/detail", bytes.NewReader(body))
	if err != nil {
		return Note{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	response, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return Note{}, httpapi.Fail(504, "笔记解析超时，请稍后重试")
		}
		return Note{}, httpapi.Fail(502, "暂时无法连接笔记解析服务")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return Note{}, httpapi.Fail(502, "笔记解析服务当前不可用")
	}
	var result struct {
		Data *struct {
			ID          string   `json:"作品ID"`
			Title       string   `json:"作品标题"`
			Description string   `json:"作品描述"`
			Type        string   `json:"作品类型"`
			Author      string   `json:"作者昵称"`
			Images      []string `json:"下载地址"`
		} `json:"data"`
	}
	if json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&result) != nil {
		return Note{}, httpapi.Fail(502, "笔记解析服务返回了无效响应")
	}
	d := result.Data
	if d == nil || d.ID == "" || len(d.Images) == 0 {
		return Note{}, httpapi.Fail(422, "无法解析这条笔记，请重新复制分享链接或检查访问限制")
	}
	if d.Type != "图文" && d.Type != "图集" && d.Type != "视频" {
		return Note{}, httpapi.Fail(422, "暂不支持这种笔记类型")
	}
	if d.Type == "视频" && len(d.Images) != 1 {
		return Note{}, httpapi.Fail(502, "笔记返回了无效视频")
	}
	match := noteID.FindStringSubmatch(u.Path)
	if len(match) != 2 || match[1] != d.ID || len(d.Images) > 80 {
		return Note{}, httpapi.Fail(502, "笔记解析结果与链接不匹配")
	}
	for _, value := range d.Images {
		u, err := url.Parse(value)
		if err != nil || u.Scheme != "https" || u.User != nil || (u.Port() != "" && u.Port() != "443") || !media.XHSHost(strings.ToLower(u.Hostname())) {
			return Note{}, httpapi.Fail(502, "笔记返回了无效媒体地址")
		}
	}
	note := Note{ID: d.ID, Title: d.Title, Description: d.Description, AuthorName: d.Author, Sources: d.Images}
	if d.Type == "视频" {
		note.VideoSource, note.Sources = d.Images[0], nil
	}
	return note, nil
}
