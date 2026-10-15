package config

import (
	"strings"
	"testing"
)

func TestMCPTokenDigest(t *testing.T) {
	t.Setenv("FRONTEND_URL", "http://localhost:5173")
	t.Setenv("XHS_API_URL", "http://127.0.0.1:5556")
	t.Setenv("GITHUB_ALLOWED_USER_ID", "37927306")
	for _, value := range []string{"", strings.Repeat("ab", 32), "short", strings.Repeat("z", 64)} {
		t.Setenv("MCP_TOKEN_SHA256", value)
		_, err := Load()
		valid := value == "" || value == strings.Repeat("ab", 32)
		if (err == nil) != valid {
			t.Fatalf("digest %q: %v", value, err)
		}
	}
}

func TestDouyinOrigin(t *testing.T) {
	t.Setenv("MCP_TOKEN_SHA256", "")
	for _, tt := range []struct {
		value string
		valid bool
	}{
		{"", true}, {"http://127.0.0.1:5555/", true}, {"http://[::1]:5555", true},
		{"http://localhost:5555", false}, {"http://192.168.1.1:5555", false}, {"https://example.com", false},
		{"http://user:secret@127.0.0.1:5555", false}, {"http://127.0.0.1:5555/path", false},
		{"http://127.0.0.1:5555?proxy=x", false}, {"http://127.0.0.1:5555#x", false},
	} {
		t.Setenv("DOUYIN_API_URL", tt.value)
		cfg, err := Load()
		if (err == nil) != tt.valid {
			t.Errorf("origin %q: %v", tt.value, err)
		}
		if err == nil && strings.HasSuffix(cfg.DouyinURL, "/") {
			t.Fatal("origin not normalized")
		}
		if tt.value == "" && cfg.DouyinURL != "http://127.0.0.1:5555" {
			t.Fatal("wrong default")
		}
	}
}
