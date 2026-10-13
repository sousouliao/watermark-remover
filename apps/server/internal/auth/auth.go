package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
)

type User struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
}
type attempt struct {
	Challenge string
	Expires   time.Time
}
type session struct {
	User    User
	Expires time.Time
}

type Service struct {
	mu        sync.Mutex
	states    map[string]attempt
	sessions  map[string]session
	oauth     oauth2.Config
	allowedID int64
	client    *http.Client
	userURL   string
	now       func() time.Time
}

func New(clientID, secret, frontend string, allowedID int64, client *http.Client) *Service {
	return &Service{states: make(map[string]attempt), sessions: make(map[string]session),
		oauth:     oauth2.Config{ClientID: clientID, ClientSecret: secret, RedirectURL: frontend + "/auth/callback", Endpoint: github.Endpoint},
		allowedID: allowedID, client: client, userURL: "https://api.github.com/user", now: time.Now}
}

func randomToken() string {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b[:])
}

func (s *Service) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/auth/github/start", s.start)
	mux.HandleFunc("POST /api/auth/github/exchange", s.exchange)
	mux.Handle("GET /api/auth/me", s.Require(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { httpapi.Success(w, s.user(r)) })))
	mux.Handle("POST /api/auth/logout", s.Require(http.HandlerFunc(s.logout)))
}

func (s *Service) pruneLocked() {
	now := s.now()
	for key, value := range s.states {
		if !now.Before(value.Expires) {
			delete(s.states, key)
		}
	}
	for key, value := range s.sessions {
		if !now.Before(value.Expires) {
			delete(s.sessions, key)
		}
	}
}

func (s *Service) start(w http.ResponseWriter, r *http.Request) {
	if s.oauth.ClientID == "" || s.oauth.ClientSecret == "" {
		httpapi.WriteError(w, httpapi.Fail(503, "GitHub 登录尚未配置"))
		return
	}
	var input struct {
		Challenge string `json:"codeChallenge"`
	}
	if err := httpapi.Decode(w, r, &input, 1024); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	b, err := base64.RawURLEncoding.DecodeString(input.Challenge)
	if err != nil || len(b) != 32 {
		httpapi.WriteError(w, httpapi.Fail(400, "登录请求无效"))
		return
	}
	state := randomToken()
	s.mu.Lock()
	s.pruneLocked()
	if len(s.states) >= 256 {
		s.mu.Unlock()
		httpapi.WriteError(w, httpapi.Fail(503, "登录服务繁忙，请稍后重试"))
		return
	}
	s.states[state] = attempt{input.Challenge, s.now().Add(5 * time.Minute)}
	s.mu.Unlock()
	authorize := s.oauth.AuthCodeURL(state, oauth2.SetAuthURLParam("code_challenge", input.Challenge), oauth2.SetAuthURLParam("code_challenge_method", "S256"))
	httpapi.Success(w, map[string]string{"authorizationUrl": authorize, "state": state})
}

func (s *Service) exchange(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Code     string `json:"code"`
		State    string `json:"state"`
		Verifier string `json:"codeVerifier"`
	}
	if err := httpapi.Decode(w, r, &input, 4096); err != nil {
		httpapi.WriteError(w, err)
		return
	}
	s.mu.Lock()
	s.pruneLocked()
	pending, ok := s.states[input.State]
	challenge := oauth2.S256ChallengeFromVerifier(input.Verifier)
	valid := ok && input.Code != "" && len(input.Verifier) >= 43 && len(input.Verifier) <= 128 && subtle.ConstantTimeCompare([]byte(pending.Challenge), []byte(challenge)) == 1
	if valid {
		delete(s.states, input.State)
	}
	s.mu.Unlock()
	if !valid {
		httpapi.WriteError(w, httpapi.Fail(400, "登录请求已失效，请重新登录"))
		return
	}
	ctx := context.WithValue(r.Context(), oauth2.HTTPClient, s.client)
	token, err := s.oauth.Exchange(ctx, input.Code, oauth2.VerifierOption(input.Verifier))
	if err != nil {
		message := "GitHub 授权失败，请重新登录"
		var urlErr *url.Error
		var netErr net.Error
		if errors.Is(err, context.DeadlineExceeded) || errors.As(err, &urlErr) || errors.As(err, &netErr) {
			message = "无法连接 GitHub 换取授权，请检查服务器到 github.com 的出站连通性"
		}
		httpapi.WriteError(w, httpapi.Fail(502, message))
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), "GET", s.userURL, nil)
	if err != nil {
		httpapi.WriteError(w, err)
		return
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	response, err := s.client.Do(req)
	if err != nil {
		httpapi.WriteError(w, httpapi.Fail(502, "暂时无法验证 GitHub 身份"))
		return
	}
	defer response.Body.Close()
	var user User
	if response.StatusCode != 200 || json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&user) != nil || user.ID == 0 {
		httpapi.WriteError(w, httpapi.Fail(502, "GitHub 返回了无效身份"))
		return
	}
	if user.ID != s.allowedID {
		httpapi.WriteError(w, httpapi.Fail(403, "此服务仅允许指定 GitHub 账号使用"))
		return
	}
	credential := randomToken()
	expires := s.now().Add(8 * time.Hour)
	s.mu.Lock()
	s.pruneLocked()
	if len(s.sessions) >= 32 {
		s.mu.Unlock()
		httpapi.WriteError(w, httpapi.Fail(503, "登录会话已达上限，请退出旧会话"))
		return
	}
	s.sessions[credential] = session{user, expires}
	s.mu.Unlock()
	httpapi.Success(w, map[string]any{"token": credential, "user": user, "expiresAt": expires.UTC().Format(time.RFC3339)})
}

type userKey struct{}

func (s *Service) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ") {
			httpapi.WriteError(w, httpapi.Fail(401, "请先使用 GitHub 登录"))
			return
		}
		credential := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		s.mu.Lock()
		s.pruneLocked()
		value, ok := s.sessions[credential]
		s.mu.Unlock()
		if !ok {
			httpapi.WriteError(w, httpapi.Fail(401, "请先使用 GitHub 登录"))
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userKey{}, value.User)))
	})
}

func (s *Service) user(r *http.Request) User {
	user, _ := r.Context().Value(userKey{}).(User)
	return user
}
func (s *Service) logout(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	delete(s.sessions, strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	s.mu.Unlock()
	httpapi.Success(w, nil)
}
