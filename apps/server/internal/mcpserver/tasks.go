package mcpserver

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/douyin"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/media"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/xhs"
)

const (
	taskTTL        = 30 * time.Minute
	taskTimeout    = 6 * time.Minute
	maxTasks       = 32
	maxActive      = 4
	maxStoredBytes = 256 << 20
)

type FileInfo struct {
	Name        string `json:"name"`
	MIME        string `json:"mimeType"`
	Bytes       int64  `json:"bytes"`
	SHA256      string `json:"sha256"`
	DownloadURL string `json:"downloadUrl,omitempty"`
	path        string
}

type taskOutput struct {
	Douyin *douyin.Parsed `json:"douyin,omitempty"`
	File   *FileInfo      `json:"file,omitempty"`
	Note   *xhs.Parsed    `json:"note,omitempty"`
	Model  string         `json:"model,omitempty"`
}

type taskView struct {
	ID        string      `json:"jobId"`
	State     string      `json:"state"`
	ExpiresAt time.Time   `json:"expiresAt"`
	Output    *taskOutput `json:"output,omitempty"`
	Message   string      `json:"message,omitempty"`
}

type task struct {
	view        taskView
	requestID   string
	fingerprint string
	done        chan struct{}
	dir         string
}

type taskStore struct {
	mu          sync.Mutex
	ctx         context.Context
	cancel      context.CancelFunc
	workers     sync.WaitGroup
	root        string
	items       map[string]*task
	keys        map[string]string
	slots       chan struct{}
	active      int
	bytes       int64
	now         func() time.Time
	downloadKey [32]byte
}

func newTaskStore() (*taskStore, error) {
	root, err := os.MkdirTemp("", "watermark-mcp-*")
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	s := &taskStore{ctx: ctx, cancel: cancel, root: root, items: make(map[string]*task), keys: make(map[string]string), slots: make(chan struct{}, 2), now: time.Now}
	if _, err := rand.Read(s.downloadKey[:]); err != nil {
		cancel()
		os.RemoveAll(root)
		return nil, err
	}
	s.workers.Add(1)
	go func() {
		defer s.workers.Done()
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.mu.Lock()
				s.prune()
				s.mu.Unlock()
			}
		}
	}()
	return s, nil
}

func (s *taskStore) Close() {
	s.mu.Lock()
	s.cancel()
	s.mu.Unlock()
	s.workers.Wait()
	_ = os.RemoveAll(s.root)
}

var requestIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,128}$`)

func (s *taskStore) Submit(requestID, fingerprint string, run func(context.Context, string) (taskOutput, error)) (taskView, error) {
	if !requestIDPattern.MatchString(requestID) {
		return taskView{}, fmt.Errorf("requestId 需为 8–128 位字母、数字、连字符或下划线，同一操作重试时复用原值")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ctx.Err() != nil {
		return taskView{}, fmt.Errorf("服务正在关闭，请稍后重试")
	}
	s.prune()
	if id, ok := s.keys[requestID]; ok {
		t := s.items[id]
		if t.fingerprint != fingerprint {
			return taskView{}, fmt.Errorf("requestId 已用于不同请求，请为新操作生成新 ID")
		}
		return t.view, nil
	}
	if s.active >= maxActive || len(s.items) >= maxTasks || s.bytes >= maxStoredBytes {
		return taskView{}, fmt.Errorf("任务或结果存储已满，请稍后再提交；已提交任务可继续查询")
	}
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return taskView{}, err
	}
	id := hex.EncodeToString(random[:])
	dir := filepath.Join(s.root, id)
	if err := os.Mkdir(dir, 0700); err != nil {
		return taskView{}, err
	}
	t := &task{view: taskView{ID: id, State: "pending", ExpiresAt: s.now().Add(taskTimeout + taskTTL)}, requestID: requestID, fingerprint: fingerprint, done: make(chan struct{}), dir: dir}
	s.items[id], s.keys[requestID] = t, id
	s.active++
	s.workers.Add(1)
	go s.execute(t, run)
	return t.view, nil
}

func (s *taskStore) execute(t *task, run func(context.Context, string) (taskOutput, error)) {
	defer s.workers.Done()
	ctx, cancel := context.WithTimeout(s.ctx, taskTimeout)
	defer cancel()
	var out taskOutput
	var err error
	select {
	case s.slots <- struct{}{}:
		s.mu.Lock()
		t.view.State = "running"
		s.mu.Unlock()
		out, err = run(ctx, t.dir)
		<-s.slots
	case <-ctx.Done():
		err = ctx.Err()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err == nil && out.File != nil && s.bytes+out.File.Bytes > maxStoredBytes {
		err = httpapi.Fail(503, "结果存储空间不足，请稍后重试")
	}
	if err != nil {
		t.view.State, t.view.Message = "failed", publicMessage(err)
		_ = os.RemoveAll(t.dir)
	} else {
		t.view.State, t.view.Output = "succeeded", &out
		if out.File != nil {
			s.bytes += out.File.Bytes
		}
	}
	t.view.ExpiresAt = s.now().Add(taskTTL)
	s.active--
	close(t.done)
}

func (s *taskStore) Get(ctx context.Context, id string, wait time.Duration) (taskView, error) {
	s.mu.Lock()
	s.prune()
	t, ok := s.items[id]
	if !ok {
		s.mu.Unlock()
		return taskView{}, fmt.Errorf("任务不存在或已过期，服务重启后任务会失效")
	}
	done := t.done
	s.mu.Unlock()
	if wait > 0 {
		timer := time.NewTimer(wait)
		defer timer.Stop()
		select {
		case <-done:
		case <-timer.C:
		case <-ctx.Done():
			return taskView{}, ctx.Err()
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return t.view, nil
}

func (s *taskStore) ReadFile(id string) ([]byte, FileInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prune()
	t, ok := s.items[id]
	if !ok {
		return nil, FileInfo{}, fmt.Errorf("任务结果不存在或已过期，请重新提交")
	}
	if t.view.State != "succeeded" || t.view.Output == nil || t.view.Output.File == nil {
		return nil, FileInfo{}, fmt.Errorf("任务尚无可领取文件，请先查询 get_task")
	}
	file := *t.view.Output.File
	data, err := os.ReadFile(file.path)
	return data, file, err
}

func (s *taskStore) FileInfo(id string) (FileInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prune()
	t, ok := s.items[id]
	if !ok || t.view.State != "succeeded" || t.view.Output == nil || t.view.Output.File == nil {
		return FileInfo{}, fmt.Errorf("尚无可领取文件，任务可能未完成、已失效或只含笔记信息，请查询 get_task")
	}
	return *t.view.Output.File, nil
}

// prune is called with mu held. Active jobs retain their working directories.
func (s *taskStore) prune() {
	for id, t := range s.items {
		if (t.view.State == "succeeded" || t.view.State == "failed") && !s.now().Before(t.view.ExpiresAt) {
			if t.view.Output != nil && t.view.Output.File != nil {
				s.bytes -= t.view.Output.File.Bytes
			}
			_ = os.RemoveAll(t.dir)
			delete(s.keys, t.requestID)
			delete(s.items, id)
		}
	}
}

func saveImage(dir, dataURL, name string) (*FileInfo, error) {
	data, kind, err := media.DecodeDataURL(dataURL)
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, data, 0600); err != nil {
		return nil, err
	}
	digest := sha256.Sum256(data)
	return &FileInfo{Name: name, MIME: kind, Bytes: int64(len(data)), SHA256: hex.EncodeToString(digest[:]), path: path}, nil
}

func publicMessage(err error) string {
	var public *httpapi.Error
	if errors.As(err, &public) {
		return public.Message
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "任务等待超时，请检查结果后再决定是否重新提交"
	}
	if errors.Is(err, context.Canceled) {
		return "任务已取消或服务已关闭"
	}
	return "任务处理失败，请稍后重试"
}
