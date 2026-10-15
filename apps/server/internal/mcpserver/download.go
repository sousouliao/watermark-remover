package mcpserver

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

const downloadTTL = 5 * time.Minute

func (s *taskStore) signature(id, expiry string) []byte {
	mac := hmac.New(sha256.New, s.downloadKey[:])
	mac.Write([]byte(id + ":" + expiry))
	return mac.Sum(nil)
}

func (s *taskStore) downloadPath(id string) string {
	expiry := strconv.FormatInt(s.now().Add(downloadTTL).Unix(), 10)
	query := url.Values{"expires": {expiry}, "signature": {hex.EncodeToString(s.signature(id, expiry))}}
	return "/api/mcp/files/" + id + "?" + query.Encode()
}

// download accepts a short-lived capability for exactly one task's file, never an API token.
func (s *Server) download(w http.ResponseWriter, r *http.Request) {
	id, expiry := r.PathValue("id"), r.URL.Query().Get("expires")
	until, err := strconv.ParseInt(expiry, 10, 64)
	sig, sigErr := hex.DecodeString(r.URL.Query().Get("signature"))
	if err != nil || sigErr != nil || !s.tasks.now().Before(time.Unix(until, 0)) || !hmac.Equal(sig, s.tasks.signature(id, expiry)) {
		http.NotFound(w, r)
		return
	}
	// Opening while holding the store lock keeps expiry cleanup from racing the open.
	s.tasks.mu.Lock()
	s.tasks.prune()
	t, ok := s.tasks.items[id]
	if !ok || t.view.Output == nil || t.view.Output.File == nil {
		s.tasks.mu.Unlock()
		http.NotFound(w, r)
		return
	}
	info := *t.view.Output.File
	file, err := os.Open(info.path)
	s.tasks.mu.Unlock()
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer file.Close()
	w.Header().Set("Content-Type", info.MIME)
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": info.Name}))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	http.ServeContent(w, r, info.Name, time.Time{}, file)
}

// saveDownload takes ownership of a completed download and preserves its original bytes.
func saveDownload(dir string, file *os.File, kind, filename string) (taskOutput, error) {
	defer os.Remove(file.Name())
	defer file.Close()
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return taskOutput{}, err
	}
	digest := sha256.New()
	if _, err := io.Copy(digest, file); err != nil {
		return taskOutput{}, err
	}
	stat, err := file.Stat()
	if err != nil {
		return taskOutput{}, err
	}
	target := filepath.Join(dir, "result")
	if err := file.Close(); err != nil {
		return taskOutput{}, err
	}
	if err := os.Rename(file.Name(), target); err != nil {
		return taskOutput{}, err
	}
	return taskOutput{File: &FileInfo{Name: filepath.Base(filename), MIME: kind, Bytes: stat.Size(), SHA256: hex.EncodeToString(digest.Sum(nil)), path: target}}, nil
}
