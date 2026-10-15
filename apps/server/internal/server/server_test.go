package server

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/config"
)

func TestRouteProtectionAndCORS(t *testing.T) {
	s, err := New(config.Config{FrontendURL: "https://frontend.vercel.app", GithubUserID: 37927306, XHSURL: "http://127.0.0.1:5556"}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Shutdown(context.Background()) })
	for _, test := range []struct {
		method, path string
		status       int
	}{{"GET", "/api/health", 200}, {"POST", "/api/watermark/remove", 401}, {"POST", "/api/upscale", 401}, {"POST", "/api/douyin/parse", 401}, {"GET", "/api/douyin/results/id/images/1", 401}, {"GET", "/api/douyin/results/id/archive", 401}, {"GET", "/api/douyin/results/id/video", 401}, {"POST", "/api/xhs/parse", 401}, {"GET", "/api/xhs/results/id/images/1", 401}, {"GET", "/api/xhs/results/id/archive", 401}, {"GET", "/api/xhs/results/id/video", 401}} {
		w := httptest.NewRecorder()
		s.Handler.ServeHTTP(w, httptest.NewRequest(test.method, test.path, nil))
		if w.Code != test.status {
			t.Errorf("%s: %d", test.path, w.Code)
		}
	}
	for _, origin := range []string{"https://frontend.vercel.app", "https://other.vercel.app"} {
		r := httptest.NewRequest("OPTIONS", "/api/xhs/parse", nil)
		r.Header.Set("Origin", origin)
		r.Header.Set("Access-Control-Request-Method", "POST")
		r.Header.Set("Access-Control-Request-Headers", "authorization,content-type")
		w := httptest.NewRecorder()
		s.Handler.ServeHTTP(w, r)
		if (w.Header().Get("Access-Control-Allow-Origin") != "") != (origin == "https://frontend.vercel.app") {
			t.Fatal("CORS origin mismatch")
		}
	}
}

func TestMCPRouteIsolation(t *testing.T) {
	digest := sha256.Sum256([]byte("probe-token"))
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	for _, enabled := range []bool{false, true} {
		cfg := config.Config{FrontendURL: "https://frontend.vercel.app", GithubUserID: 37927306, XHSURL: "http://127.0.0.1:5556"}
		if enabled {
			cfg.MCPTokenSHA256 = hex.EncodeToString(digest[:])
		}
		s, err := New(cfg, logger)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = s.Shutdown(context.Background()) })
		for _, path := range []string{"/api/mcp", "/api/upscale", "/.well-known/oauth-protected-resource", "/.well-known/oauth-authorization-server"} {
			r := httptest.NewRequest("POST", "http://43.138.214.93"+path, strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}`))
			r.Header.Set("Authorization", "Bearer probe-token")
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("Accept", "application/json, text/event-stream")
			w := httptest.NewRecorder()
			s.Handler.ServeHTTP(w, r)
			want := 404
			if path == "/api/upscale" {
				want = 401 // MCP credential never authenticates the web API.
			}
			if path == "/api/mcp" && enabled {
				want = 200
				if !strings.Contains(w.Body.String(), "watermark-remover") {
					t.Fatalf("initialization through application middleware: %s", w.Body)
				}
			}
			if w.Code != want {
				t.Fatalf("enabled=%v path=%s status=%d want=%d", enabled, path, w.Code, want)
			}
		}
	}
}
