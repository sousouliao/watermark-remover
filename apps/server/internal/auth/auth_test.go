package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/oauth2"
)

func request(t *testing.T, mux http.Handler, path string, body any, token string) *httptest.ResponseRecorder {
	t.Helper()
	b, _ := json.Marshal(body)
	r := httptest.NewRequest("POST", path, bytes.NewReader(b))
	if token != "" {
		r.Header.Set("Authorization", token)
	}
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	return w
}

func TestConcurrentSessionLookupAndRevocation(t *testing.T) {
	s := New("", "", "https://frontend.vercel.app", 37927306, http.DefaultClient)
	s.sessions["token"] = session{User{37927306, "sousouliao"}, time.Now().Add(time.Hour)}
	guard := s.Require(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	var group sync.WaitGroup
	for i := 0; i < 20; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			for j := 0; j < 20; j++ {
				r := httptest.NewRequest("GET", "/", nil)
				r.Header.Set("Authorization", "Bearer token")
				w := httptest.NewRecorder()
				guard.ServeHTTP(w, r)
				if w.Code != 204 && w.Code != 401 {
					t.Errorf("unexpected auth status: %d", w.Code)
				}
			}
		}()
	}
	s.mu.Lock()
	delete(s.sessions, "token")
	s.mu.Unlock()
	group.Wait()
}

func TestOAuthLoginAndAccessControl(t *testing.T) {
	userID := int64(37927306)
	var verifier string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/token":
			_ = r.ParseForm()
			if r.Form.Get("code_verifier") != verifier {
				t.Errorf("PKCE verifier missing")
			}
			fmt.Fprint(w, `{"access_token":"github-test-token","token_type":"bearer"}`)
		case "/user":
			if r.Header.Get("Authorization") != "Bearer github-test-token" {
				t.Error("GitHub authorization missing")
			}
			fmt.Fprintf(w, `{"id":%d,"login":"sousouliao"}`, userID)
		}
	}))
	defer upstream.Close()
	s := New("client", "secret", "https://frontend.vercel.app", 37927306, upstream.Client())
	s.oauth.Endpoint.TokenURL = upstream.URL + "/token"
	s.oauth.Endpoint.AuthStyle = oauth2.AuthStyleInParams
	s.userURL = upstream.URL + "/user"
	mux := http.NewServeMux()
	s.Register(mux)
	start := func() string {
		verifier = oauth2.GenerateVerifier()
		w := request(t, mux, "/api/auth/github/start", map[string]string{"codeChallenge": oauth2.S256ChallengeFromVerifier(verifier)}, "")
		if w.Code != 200 {
			t.Fatalf("start: %s", w.Body)
		}
		var result struct {
			Data struct {
				State string `json:"state"`
				URL   string `json:"authorizationUrl"`
			} `json:"data"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &result)
		u, _ := url.Parse(result.Data.URL)
		if u.Query().Get("redirect_uri") != "https://frontend.vercel.app/auth/callback" || u.Query().Get("code_challenge_method") != "S256" || u.Query().Get("scope") != "" {
			t.Fatal("incorrect OAuth parameters")
		}
		return result.Data.State
	}
	state := start()
	w := request(t, mux, "/api/auth/github/exchange", map[string]string{"state": state, "code": "code", "codeVerifier": "incorrect"}, "")
	if w.Code != 400 {
		t.Fatal("invalid PKCE accepted")
	}
	body := map[string]string{"state": state, "code": "code", "codeVerifier": verifier}
	w = request(t, mux, "/api/auth/github/exchange", body, "")
	if w.Code != 200 {
		t.Fatalf("exchange: %s", w.Body)
	}
	var sessionResponse struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &sessionResponse)
	credential := sessionResponse.Data.Token
	if strings.Contains(w.Body.String(), "github-test-token") {
		t.Fatal("GitHub token leaked")
	}
	if request(t, mux, "/api/auth/github/exchange", body, "").Code != 400 {
		t.Fatal("state replay accepted")
	}
	guard := s.Require(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	check := func(token string) int {
		r := httptest.NewRequest("GET", "/", nil)
		r.Header.Set("Authorization", token)
		w := httptest.NewRecorder()
		guard.ServeHTTP(w, r)
		return w.Code
	}
	if check(credential) != 401 || check("Bearer "+credential) != 204 {
		t.Fatal("Bearer guard incorrect")
	}
	request(t, mux, "/api/auth/logout", nil, "Bearer "+credential)
	if check("Bearer "+credential) != 401 {
		t.Fatal("logout did not revoke")
	}
	state = start()
	userID = 123
	w = request(t, mux, "/api/auth/github/exchange", map[string]string{"state": state, "code": "code", "codeVerifier": verifier}, "")
	if w.Code != 403 {
		t.Fatal("non-owner admitted")
	}
	state = start()
	s.now = func() time.Time { return time.Now().Add(6 * time.Minute) }
	if request(t, mux, "/api/auth/github/exchange", map[string]string{"state": state, "code": "code", "codeVerifier": verifier}, "").Code != 400 {
		t.Fatal("expired state admitted")
	}
}
