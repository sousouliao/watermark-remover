package server

import (
	"io"
	"log/slog"
	"net/http/httptest"
	"testing"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/config"
)

func TestRouteProtectionAndCORS(t *testing.T) {
	s := New(config.Config{FrontendURL: "https://frontend.vercel.app", GithubUserID: 37927306, XHSURL: "http://127.0.0.1:5556"}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	for _, test := range []struct {
		method, path string
		status       int
	}{{"GET", "/api/health", 200}, {"POST", "/api/watermark/remove", 401}, {"POST", "/api/upscale", 401}, {"POST", "/api/xhs/parse", 401}, {"GET", "/api/xhs/results/id/images/1", 401}, {"GET", "/api/xhs/results/id/archive", 401}} {
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
