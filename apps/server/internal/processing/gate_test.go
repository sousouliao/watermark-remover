package processing

import (
	"context"
	"testing"
	"time"
)

func TestWebAndAsyncShareSlot(t *testing.T) {
	g := New()
	if err := g.TryAcquire(); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	if err := g.Acquire(ctx); err != context.DeadlineExceeded {
		t.Fatalf("async ignored occupied HTTP slot: %v", err)
	}
	g.Release()
	if err := g.Acquire(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := g.TryAcquire(); err == nil {
		t.Fatal("HTTP ignored occupied async slot")
	}
	g.Release()
}
