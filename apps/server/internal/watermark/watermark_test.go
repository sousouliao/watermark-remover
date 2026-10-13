package watermark

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
)

func TestModelAndRegionContract(t *testing.T) {
	encoded := base64.StdEncoding.EncodeToString([]byte("\x89PNG\r\n\x1a\nexample"))
	image := "data:image/png;base64," + encoded
	for _, model := range []string{"lite", "flash"} {
		t.Run(model, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var body map[string]any
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					t.Error(err)
				}
				if body["model"] != "ep-"+model || body["watermark"] != false || body["output_format"] != "png" {
					t.Error("wrong model request")
				}
				if !strings.Contains(body["prompt"].(string), "<bbox>10 20 30 40</bbox>") {
					t.Error("region missing")
				}
				w.Header().Set("Content-Type", "application/json")
				fmt.Fprintf(w, `{"data":[{"b64_json":%q}]}`, encoded)
			}))
			defer upstream.Close()
			s := New(upstream.Client(), "key", "ep-lite", "ep-flash")
			s.url = upstream.URL
			result, err := s.Remove(context.Background(), Input{image, model, "region", &Region{10, 20, 30, 40}})
			if err != nil || result.Image != image || result.Model != model {
				t.Fatalf("unexpected output: %v %v", result, err)
			}
		})
	}
	s := New(http.DefaultClient, "", "", "")
	for _, input := range []Input{{image, "other", "direct", nil}, {image, "lite", "region", &Region{30, 20, 10, 40}}, {image, "lite", "direct", &Region{1, 1, 2, 2}}, {"data:image/png;base64,ZmFrZQ==", "lite", "direct", nil}} {
		_, err := s.Remove(context.Background(), input)
		e, ok := err.(*httpapi.Error)
		if !ok || e.Status != 400 {
			t.Fatalf("invalid input accepted: %v", err)
		}
	}
	var region Region
	if json.Unmarshal([]byte(`{"y1":0,"x2":20,"y2":20}`), &region) == nil {
		t.Fatal("missing coordinate accepted")
	}
}
