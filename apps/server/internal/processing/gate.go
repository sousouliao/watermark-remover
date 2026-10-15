// Package processing shares the image-processing slot between HTTP and MCP.
package processing

import (
	"context"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
)

type Gate struct{ slot chan struct{} }

func New() *Gate { return &Gate{slot: make(chan struct{}, 1)} }

func (g *Gate) TryAcquire() error {
	select {
	case g.slot <- struct{}{}:
		return nil
	default:
		return httpapi.Fail(503, "图像服务当前繁忙，请稍后重试")
	}
}

func (g *Gate) Acquire(ctx context.Context) error {
	select {
	case g.slot <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (g *Gate) Release() { <-g.slot }
