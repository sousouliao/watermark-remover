// Package mcpserver exposes the image services through authenticated MCP tools.
package mcpserver

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/media"
	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	imageURI = "watermark-probe://test/image.png"
	zipURI   = "watermark-probe://test/archive.zip"
)

type empty struct{}
type echoInput struct {
	Image string `json:"image" jsonschema:"PNG, JPEG or WebP base64 data URL; upload file contents, not a local path"`
}
type imageInfo struct {
	SHA256 string `json:"sha256"`
	Bytes  int    `json:"bytes"`
}
type waitInput struct {
	Seconds int `json:"seconds" jsonschema:"Whole seconds to wait, from 0 to 300; no paid services are called"`
}

type Server struct {
	http.Handler
	tasks *taskStore
}

func (s *Server) Close() {
	if s.tasks != nil {
		s.tasks.Close()
	}
}

// New mounts the SDK transport and the product tools in one authenticated service.
func New(tokenSHA256 string, logger *slog.Logger, backend *Backend) (*Server, error) {
	expected, err := hex.DecodeString(tokenSHA256)
	if err != nil || len(expected) != sha256.Size {
		return nil, fmt.Errorf("invalid MCP token digest")
	}
	server := mcp.NewServer(&mcp.Implementation{Name: "watermark-remover", Version: "1.0.0"}, nil)
	server.AddReceivingMiddleware(func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			start := time.Now()
			result, err := next(ctx, method, req)
			logger.Info("mcp request", "method", method, "authenticated", true, "duration_ms", time.Since(start).Milliseconds(), "protocol_error", err != nil)
			return result, err
		}
	})
	service := &Server{}
	if backend != nil {
		store, err := newTaskStore()
		if err != nil {
			return nil, err
		}
		service.tasks = store
		registerBusiness(server, store, backend)
	}
	if backend == nil || backend.EnableProbes {
		registerProbes(server, service.tasks)
	}
	handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return server }, &mcp.StreamableHTTPOptions{
		Stateless: true, MaxRequestBodyBytes: 50 << 20, PropagateRequestCancellation: true,
		// Nginx preserves the public Host while proxying to the loopback listener.
		// Bearer auth and browser origin protection remain enforced below.
		DisableLocalhostProtection: true,
	})
	protected := http.NewCrossOriginProtection().Handler(handler)
	protectedMCP := auth.RequireBearerToken(func(_ context.Context, token string, _ *http.Request) (*auth.TokenInfo, error) {
		actual := sha256.Sum256([]byte(token))
		if subtle.ConstantTimeCompare(actual[:], expected) != 1 {
			return nil, auth.ErrInvalidToken
		}
		return &auth.TokenInfo{UserID: "personal-grok-bot"}, nil
	}, &auth.RequireBearerTokenOptions{AllowMissingExpiration: true})(protected)
	mux := http.NewServeMux()
	mux.Handle("/api/mcp", protectedMCP)
	if service.tasks != nil {
		mux.HandleFunc("GET /api/mcp/files/{id}", service.download)
	}
	service.Handler = mux
	return service, nil
}

func registerProbes(server *mcp.Server, store *taskStore) {
	mcp.AddTool(server, &mcp.Tool{Name: "probe_ping", Description: "Check MCP connectivity without calling any external service"},
		func(context.Context, *mcp.CallToolRequest, empty) (*mcp.CallToolResult, map[string]string, error) {
			return nil, map[string]string{"status": "ok", "service": "watermark-compatibility-probe"}, nil
		})
	mcp.AddTool(server, &mcp.Tool{Name: "probe_echo_image", Description: "Return the exact uploaded image as ImageContent and its SHA-256; does not process or store it"}, echoImage)
	imageBytes, archiveBytes := testFiles()
	for _, file := range []struct {
		uri, name, kind string
		data            []byte
	}{{imageURI, "image.png", "image/png", imageBytes}, {zipURI, "archive.zip", "application/zip", archiveBytes}} {
		server.AddResource(&mcp.Resource{URI: file.uri, Name: file.name, MIMEType: file.kind},
			func(context.Context, *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
				return &mcp.ReadResourceResult{Contents: []*mcp.ResourceContents{{URI: file.uri, MIMEType: file.kind, Blob: file.data}}}, nil
			})
	}
	mcp.AddTool(server, &mcp.Tool{Name: "probe_test_files", Description: "Return a sample ImageContent and PNG/ZIP resource links; read links using resources/read, not HTTP"},
		func(context.Context, *mcp.CallToolRequest, empty) (*mcp.CallToolResult, any, error) {
			return &mcp.CallToolResult{Content: []mcp.Content{
				&mcp.ImageContent{Data: imageBytes, MIMEType: "image/png"},
				&mcp.ResourceLink{URI: imageURI, Name: "image.png", MIMEType: "image/png"},
				&mcp.ResourceLink{URI: zipURI, Name: "archive.zip", MIMEType: "application/zip"},
			}}, nil, nil
		})
	waitSlots := make(chan struct{}, 1)
	mcp.AddTool(server, &mcp.Tool{Name: "probe_wait", Description: "Test 0–300 second calls and optional progress; only one wait runs at a time"},
		func(ctx context.Context, req *mcp.CallToolRequest, in waitInput) (*mcp.CallToolResult, map[string]int, error) {
			select {
			case waitSlots <- struct{}{}:
				defer func() { <-waitSlots }()
			default:
				return nil, nil, fmt.Errorf("another wait probe is running")
			}
			if err := wait(ctx, req, in.Seconds); err != nil {
				return nil, nil, err
			}
			return nil, map[string]int{"waitedSeconds": in.Seconds}, nil
		})

	if store != nil {
		mcp.AddTool(server, &mcp.Tool{Name: "probe_job", Description: "Free async ZIP compatibility test; seconds 0–300. Query with get_task and receive get_task_result"},
			func(_ context.Context, _ *mcp.CallToolRequest, in struct {
				RequestID string `json:"requestId"`
				Seconds   int    `json:"seconds"`
			}) (*mcp.CallToolResult, taskView, error) {
				if in.Seconds < 0 || in.Seconds > 300 {
					return nil, taskView{}, fmt.Errorf("seconds must be 0–300")
				}
				job, err := store.Submit(in.RequestID, fingerprint("probe_job", in), func(ctx context.Context, dir string) (taskOutput, error) {
					timer := time.NewTimer(time.Duration(in.Seconds) * time.Second)
					defer timer.Stop()
					select {
					case <-timer.C:
					case <-ctx.Done():
						return taskOutput{}, ctx.Err()
					}
					_, data := testFiles()
					path := filepath.Join(dir, "archive.zip")
					if err := os.WriteFile(path, data, 0600); err != nil {
						return taskOutput{}, err
					}
					digest := sha256.Sum256(data)
					return taskOutput{File: &FileInfo{Name: "probe-archive.zip", MIME: "application/zip", Bytes: int64(len(data)), SHA256: hex.EncodeToString(digest[:]), path: path}}, nil
				})
				return nil, job, err
			})
	}
}

func echoImage(_ context.Context, _ *mcp.CallToolRequest, in echoInput) (*mcp.CallToolResult, imageInfo, error) {
	data, kind, err := media.DecodeDataURL(in.Image)
	if err != nil {
		return nil, imageInfo{}, err
	}
	digest := sha256.Sum256(data)
	return &mcp.CallToolResult{Content: []mcp.Content{&mcp.ImageContent{Data: data, MIMEType: kind}}},
		imageInfo{SHA256: hex.EncodeToString(digest[:]), Bytes: len(data)}, nil
}

func wait(ctx context.Context, req *mcp.CallToolRequest, seconds int) error {
	if seconds < 0 || seconds > 300 {
		return fmt.Errorf("seconds must be between 0 and 300")
	}
	ctx, cancel := context.WithTimeout(ctx, 310*time.Second)
	defer cancel()
	end := time.NewTimer(time.Duration(seconds) * time.Second)
	defer end.Stop()
	ticks := time.NewTicker(10 * time.Second)
	defer ticks.Stop()
	start := time.Now()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-end.C:
			return nil
		case <-ticks.C:
			if token := req.Params.GetProgressToken(); token != nil {
				if err := req.Session.NotifyProgress(ctx, &mcp.ProgressNotificationParams{
					ProgressToken: token, Progress: time.Since(start).Seconds(), Total: float64(seconds), Message: "Compatibility probe waiting",
				}); err != nil {
					return err
				}
			}
		}
	}
}

func testFiles() ([]byte, []byte) {
	img := image.NewRGBA(image.Rect(0, 0, 64, 64))
	for y := range 64 {
		for x := range 64 {
			img.SetRGBA(x, y, color.RGBA{R: uint8(x * 4), G: uint8(y * 4), B: 128, A: 255})
		}
	}
	var picture, archive bytes.Buffer
	// bytes.Buffer writes never fail; the fixed image and ZIP names are valid.
	_ = png.Encode(&picture, img)
	writer := zip.NewWriter(&archive)
	f, _ := writer.Create("image.png")
	_, _ = f.Write(picture.Bytes())
	f, _ = writer.Create("README.txt")
	_, _ = f.Write([]byte("Watermark Remover MCP compatibility probe. No model or external service was called.\n"))
	_ = writer.Close()
	return picture.Bytes(), archive.Bytes()
}
