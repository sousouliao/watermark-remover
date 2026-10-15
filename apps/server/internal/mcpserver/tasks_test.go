package mcpserver

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
)

func testStore(t *testing.T) *taskStore {
	t.Helper()
	s, err := newTaskStore()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	return s
}

func TestTaskIdempotencyAndDetachedLifetime(t *testing.T) {
	s := testStore(t)
	start, finish := make(chan struct{}), make(chan struct{})
	var count atomic.Int32
	work := func(ctx context.Context, dir string) (taskOutput, error) {
		count.Add(1)
		close(start)
		select {
		case <-finish:
		case <-ctx.Done():
			return taskOutput{}, ctx.Err()
		}
		path := filepath.Join(dir, "output")
		if err := os.WriteFile(path, []byte("result"), 0600); err != nil {
			return taskOutput{}, err
		}
		return taskOutput{File: &FileInfo{Name: "image.png", MIME: "image/png", Bytes: 6, path: path}}, nil
	}
	job, err := s.Submit("same-request", "fingerprint", work)
	if err != nil {
		t.Fatal(err)
	}
	<-start
	var group sync.WaitGroup
	for range 10 {
		group.Add(1)
		go func() {
			defer group.Done()
			other, err := s.Submit("same-request", "fingerprint", work)
			if err != nil || other.ID != job.ID {
				t.Errorf("duplicate: %+v %v", other, err)
			}
		}()
	}
	group.Wait()
	if _, err := s.Submit("same-request", "changed", work); err == nil {
		t.Fatal("changed input reused requestId")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := s.Get(ctx, job.ID, time.Second); !errors.Is(err, context.Canceled) {
		t.Fatalf("query cancellation: %v", err)
	}
	// Canceling a query must not cancel or duplicate the already accepted operation.
	close(finish)
	view, err := s.Get(context.Background(), job.ID, time.Second)
	if err != nil || view.State != "succeeded" || count.Load() != 1 {
		t.Fatalf("completion: %+v %v count=%d", view, err, count.Load())
	}
	data, _, err := s.ReadFile(job.ID)
	if err != nil || string(data) != "result" {
		t.Fatalf("result: %q %v", data, err)
	}
	root := s.root
	s.Close()
	if _, err := os.Stat(root); !os.IsNotExist(err) {
		t.Fatal("close left files behind")
	}
	if _, err := s.Submit("after-close", "x", work); err == nil {
		t.Fatal("closed store accepted work")
	}
}

func TestTaskFailureExpiryAndCapacity(t *testing.T) {
	s := testStore(t)
	job, err := s.Submit("failure-1", "x", func(context.Context, string) (taskOutput, error) {
		return taskOutput{}, httpapi.Fail(502, "上游暂时不可用")
	})
	if err != nil {
		t.Fatal(err)
	}
	view, err := s.Get(context.Background(), job.ID, time.Second)
	if err != nil || view.State != "failed" || view.Message != "上游暂时不可用" {
		t.Fatalf("failure: %+v %v", view, err)
	}
	s.mu.Lock()
	s.items[job.ID].view.ExpiresAt = time.Now().Add(-time.Second)
	s.mu.Unlock()
	if _, err := s.Get(context.Background(), job.ID, 0); err == nil {
		t.Fatal("expired task remained visible")
	}
	if _, err := os.Stat(filepath.Join(s.root, job.ID)); !os.IsNotExist(err) {
		t.Fatal("expired task left files")
	}
	for i := 0; i < maxActive; i++ {
		if _, err := s.Submit("queued-"+string(rune('a'+i)), "x", func(ctx context.Context, _ string) (taskOutput, error) { <-ctx.Done(); return taskOutput{}, ctx.Err() }); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.Submit("too-many-tasks", "x", nil); err == nil {
		t.Fatal("active capacity not bounded")
	}
	// Closing cancels both running and queued operations rather than waiting for their timeout.
	s.Close()
}
