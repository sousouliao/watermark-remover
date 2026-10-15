package media

import (
	"context"
	"encoding/base64"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
)

const MaxImageBytes int64 = 30 << 20

func ImageType(b []byte) string {
	if len(b) >= 8 && string(b[:8]) == "\x89PNG\r\n\x1a\n" {
		return "image/png"
	}
	if len(b) >= 3 && b[0] == 0xff && b[1] == 0xd8 && b[2] == 0xff {
		return "image/jpeg"
	}
	if len(b) >= 12 && string(b[:4]) == "RIFF" && string(b[8:12]) == "WEBP" {
		return "image/webp"
	}
	return ""
}

func DecodeDataURL(value string) ([]byte, string, error) {
	meta, encoded, ok := strings.Cut(value, ",")
	if !ok || !strings.HasSuffix(meta, ";base64") || len(encoded) > int((MaxImageBytes+2)/3*4) {
		return nil, "", httpapi.Fail(400, "请提供不超过 30 MB 的 PNG、JPEG 或 WebP 图片")
	}
	b, err := base64.StdEncoding.DecodeString(encoded)
	contentType := ImageType(b)
	if err != nil || int64(len(b)) > MaxImageBytes || contentType == "" || meta != "data:"+contentType+";base64" {
		return nil, "", httpapi.Fail(400, "图片格式或内容无效")
	}
	return b, contentType, nil
}

type Client struct {
	client   *http.Client
	allowed  func(string) bool
	maxBytes int64
}

func XHSHost(host string) bool {
	return host == "ci.xiaohongshu.com" || host == "xhscdn.com" || strings.HasSuffix(host, ".xhscdn.com")
}
func PageHost(host string) bool {
	return host == "xhslink.com" || host == "www.xhslink.com" || host == "www.xiaohongshu.com" || host == "xiaohongshu.com"
}

func NewClient(allowed func(string) bool) *Client {
	c := &Client{allowed: allowed, maxBytes: MaxImageBytes}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = publicDial
	c.client = &http.Client{Transport: transport, Timeout: 25 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) > 5 {
			return httpapi.Fail(502, "媒体重定向次数超过限制")
		}
		return c.validate(req.URL)
	}}
	return c
}

func (c *Client) validate(u *url.URL) error {
	if u.Scheme != "https" || u.User != nil || (u.Port() != "" && u.Port() != "443") || !c.allowed(strings.ToLower(u.Hostname())) {
		return httpapi.Fail(502, "资源地址不在允许范围内")
	}
	return nil
}

func (c *Client) Get(ctx context.Context, value string) (*http.Response, error) {
	u, err := url.Parse(value)
	if err != nil {
		return nil, httpapi.Fail(502, "资源地址无效")
	}
	if err := c.validate(u); err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if err != nil {
		return nil, httpapi.Fail(502, "资源地址无效")
	}
	req.Header.Set("Accept-Encoding", "identity")
	response, err := c.client.Do(req)
	if err != nil {
		return nil, httpapi.Fail(502, "暂时无法取得媒体资源")
	}
	if response.StatusCode != 200 {
		response.Body.Close()
		return nil, httpapi.Fail(502, "媒体资源不可用，请重新解析")
	}
	if response.ContentLength > c.maxBytes {
		response.Body.Close()
		return nil, httpapi.Fail(502, "媒体超过下载大小限制")
	}
	return response, nil
}

func (c *Client) ReadImage(ctx context.Context, value string) ([]byte, string, error) {
	response, err := c.Get(ctx, value)
	if err != nil {
		return nil, "", err
	}
	defer response.Body.Close()
	b, err := io.ReadAll(io.LimitReader(response.Body, MaxImageBytes+1))
	if err != nil || int64(len(b)) > MaxImageBytes {
		return nil, "", httpapi.Fail(502, "图片下载失败或超过大小限制")
	}
	kind := ImageType(b)
	if kind == "" {
		return nil, "", httpapi.Fail(502, "资源不是有效的 PNG、JPEG 或 WebP 图片")
	}
	return b, kind, nil
}

var blocked = func() []netip.Prefix {
	var result []netip.Prefix
	for _, value := range []string{"0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4", "2001::/23", "2001:db8::/32", "2002::/16"} {
		result = append(result, netip.MustParsePrefix(value))
	}
	return result
}()

func PublicAddress(addr netip.Addr) bool {
	addr = addr.Unmap()
	if !addr.IsGlobalUnicast() {
		return false
	}
	if addr.Is6() && !netip.MustParsePrefix("2000::/3").Contains(addr) {
		return false
	}
	for _, prefix := range blocked {
		if prefix.Contains(addr) {
			return false
		}
	}
	return true
}

func publicDial(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}
	addresses, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	if err != nil || len(addresses) == 0 {
		return nil, httpapi.Fail(502, "资源域名解析失败")
	}
	for _, addr := range addresses {
		if !PublicAddress(addr) {
			return nil, httpapi.Fail(502, "资源地址解析到非公网网络")
		}
	}
	var last error
	for _, addr := range addresses {
		conn, err := (&net.Dialer{Timeout: 10 * time.Second}).DialContext(ctx, network, net.JoinHostPort(addr.String(), port))
		if err == nil {
			return conn, nil
		}
		last = err
	}
	return nil, last
}
