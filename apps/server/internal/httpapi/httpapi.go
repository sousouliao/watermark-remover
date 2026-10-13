package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

// Error carries a safe public message; upstream responses never become messages.
type Error struct {
	Status  int
	Message string
}

func (e *Error) Error() string              { return e.Message }
func Fail(status int, message string) error { return &Error{status, message} }

func WriteError(w http.ResponseWriter, err error) {
	status, message := http.StatusInternalServerError, "服务处理失败，请稍后重试"
	var public *Error
	if errors.As(err, &public) {
		status, message = public.Status, public.Message
	}
	WriteJSON(w, status, map[string]any{"success": false, "message": message, "timestamp": time.Now().UTC().Format(time.RFC3339)})
}

func WriteJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func Success(w http.ResponseWriter, data any) {
	WriteJSON(w, http.StatusOK, map[string]any{"success": true, "data": data, "timestamp": time.Now().UTC().Format(time.RFC3339)})
}

func Decode(w http.ResponseWriter, r *http.Request, value any, limit int64) error {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		var size *http.MaxBytesError
		if errors.As(err, &size) {
			return Fail(413, "请求内容超过大小限制")
		}
		return Fail(400, "请求参数无效")
	}
	if decoder.Decode(new(any)) != io.EOF {
		return Fail(400, "请求只能包含一个 JSON 对象")
	}
	return nil
}
