package media

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestRestrictedMediaTransport(t *testing.T) {
	for _, address := range []string{"127.0.0.1", "::1", "::ffff:127.0.0.1", "10.0.0.2", "169.254.169.254", "198.18.1.1", "2001:db8::1"} {
		if PublicAddress(netip.MustParseAddr(address)) {
			t.Fatalf("private IP allowed: %s", address)
		}
	}
	for _, address := range []string{"1.1.1.1", "2606:4700:4700::1111"} {
		if !PublicAddress(netip.MustParseAddr(address)) {
			t.Fatalf("public IP rejected: %s", address)
		}
	}
	c := NewClient(XHSHost)
	for _, value := range []string{"http://ci.xiaohongshu.com/a", "https://ci.xiaohongshu.com.evil.test/a", "https://127.0.0.1/a", "https://user:pass@ci.xiaohongshu.com/a", "https://ci.xiaohongshu.com:8080/a"} {
		if _, err := c.Get(context.Background(), value); err == nil {
			t.Fatal("invalid target allowed")
		}
	}
	c.client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 302, Header: http.Header{"Location": []string{"https://127.0.0.1/private"}}, Body: io.NopCloser(strings.NewReader("")), Request: r}, nil
	})
	if _, err := c.Get(context.Background(), "https://ci.xiaohongshu.com/a"); err == nil {
		t.Fatal("private redirect allowed")
	}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("<html>login</html>")) }))
	defer upstream.Close()
	c.client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) { return upstream.Client().Get(upstream.URL) })
	if _, _, err := c.ReadImage(context.Background(), "https://ci.xiaohongshu.com/a"); err == nil {
		t.Fatal("HTML accepted as image")
	}
}
