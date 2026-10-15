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
