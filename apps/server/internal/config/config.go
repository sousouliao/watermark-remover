package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Address, FrontendURL, XHSURL        string
	ArkKey, LiteEndpoint, FlashEndpoint string
	GithubClientID, GithubClientSecret  string
	GithubUserID                        int64
}

func Load() (Config, error) {
	c := Config{
		Address:     env("LISTEN_ADDR", "127.0.0.1:"+env("PORT", "3000")),
		FrontendURL: env("FRONTEND_URL", "http://localhost:5173"),
		XHSURL:      env("XHS_API_URL", "http://127.0.0.1:5556"),
		ArkKey:      os.Getenv("ARK_API_KEY"), LiteEndpoint: os.Getenv("ARK_SEEDREAM_LITE_ENDPOINT"), FlashEndpoint: os.Getenv("ARK_SEEDREAM_FLASH_ENDPOINT"),
		GithubClientID: os.Getenv("GITHUB_CLIENT_ID"), GithubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
	}
	var err error
	c.GithubUserID, err = strconv.ParseInt(env("GITHUB_ALLOWED_USER_ID", "37927306"), 10, 64)
	if err != nil || c.GithubUserID <= 0 {
		return c, fmt.Errorf("GITHUB_ALLOWED_USER_ID must be a positive integer")
	}
	for name, value := range map[string]string{"FRONTEND_URL": c.FrontendURL, "XHS_API_URL": c.XHSURL} {
		u, err := url.Parse(value)
		if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Scheme != "http" && u.Scheme != "https") || (u.Path != "" && u.Path != "/") {
			return c, fmt.Errorf("%s must be an HTTP(S) origin", name)
		}
	}
	c.FrontendURL = strings.TrimRight(c.FrontendURL, "/")
	c.XHSURL = strings.TrimRight(c.XHSURL, "/")
	return c, nil
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
