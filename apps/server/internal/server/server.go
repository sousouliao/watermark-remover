package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/auth"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/config"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/upscale"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/watermark"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/xhs"
	"github.com/rs/cors"
)

func New(cfg config.Config, logger *slog.Logger) *http.Server {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = http.ProxyFromEnvironment
	client := &http.Client{Transport: transport, Timeout: 185 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	authentication := auth.New(cfg.GithubClientID, cfg.GithubClientSecret, cfg.FrontendURL, cfg.GithubUserID, &http.Client{Transport: transport, Timeout: 15 * time.Second, CheckRedirect: client.CheckRedirect})
	watermarks := watermark.New(client, cfg.ArkKey, cfg.LiteEndpoint, cfg.FlashEndpoint)
	enhancement := upscale.New(client)
	notes := xhs.New(xhs.NewClient(client, cfg.XHSURL))
	mux := http.NewServeMux()
	authentication.Register(mux)
	for _, path := range []string{"GET /api/health", "GET /api/health/ready"} {
		mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
			status := "ok"
			if r.URL.Path == "/api/health/ready" {
				status = "ready"
			}
			httpapi.WriteJSON(w, 200, map[string]any{"status": status, "timestamp": time.Now().UTC().Format(time.RFC3339)})
		})
	}
	processing := make(chan struct{}, 1)
	protect := func(handler http.HandlerFunc) http.Handler { return authentication.Require(handler) }
	bounded := func(handler http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			select {
			case processing <- struct{}{}:
				defer func() { <-processing }()
				handler(w, r)
			default:
				httpapi.WriteError(w, httpapi.Fail(503, "图像服务当前繁忙，请稍后重试"))
			}
		}
	}
	mux.Handle("POST /api/watermark/remove", protect(bounded(watermarks.Handler)))
	mux.Handle("POST /api/upscale", protect(bounded(enhancement.Handler)))
	mux.Handle("POST /api/xhs/parse", protect(notes.ParseHandler))
	mux.Handle("GET /api/xhs/results/{id}/images/{index}", protect(notes.ImageHandler))
	mux.Handle("GET /api/xhs/results/{id}/archive", protect(notes.ArchiveHandler))
	crossOrigin := cors.New(cors.Options{AllowedOrigins: []string{cfg.FrontendURL}, AllowedMethods: []string{"GET", "POST"}, AllowedHeaders: []string{"Authorization", "Content-Type"}, ExposedHeaders: []string{"Content-Disposition"}, MaxAge: 600})
	return &http.Server{Addr: cfg.Address, Handler: logging(logger, crossOrigin.Handler(mux)), ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (w *responseWriter) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
		w.ResponseWriter.WriteHeader(status)
	}
}
func (w *responseWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(200)
	}
	return w.ResponseWriter.Write(b)
}
func (w *responseWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func logging(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		out := &responseWriter{ResponseWriter: w}
		defer func() {
			if recover() != nil {
				logger.Error("request panic", "path", r.URL.Path)
				if out.status == 0 {
					httpapi.WriteError(out, httpapi.Fail(500, "服务处理失败"))
				}
			}
			logger.Info("request", "method", r.Method, "path", r.URL.Path, "status", out.status, "duration_ms", time.Since(start).Milliseconds())
		}()
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(out, r)
	})
}
