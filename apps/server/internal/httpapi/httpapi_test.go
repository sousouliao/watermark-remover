package httpapi

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRequestBoundary(t *testing.T) {
	for _, body := range []string{`{"known":"ok","extra":true}`, `{"known":"ok"} {"known":"again"}`, `null trailing`, `{"known":"` + strings.Repeat("x", 100) + `"}`} {
		var input struct {
			Known string `json:"known"`
		}
		if Decode(httptest.NewRecorder(), httptest.NewRequest("POST", "/", strings.NewReader(body)), &input, 64) == nil {
			t.Fatal("invalid or oversized request accepted")
		}
	}
}
