# 2026-10-15 登录会话延长到七天

- 用户反馈八小时太短。`apps/server/internal/auth/auth.go` 新增常量 `sessionTTL = 7 * 24 * time.Hour`，登录时的会话过期时间改用它；2026-10-13 记录中的“八小时有效”以此为准更新为七天。
- 会话仍只存内存：后端重启后全部失效，容量上限 32 不变。
- 本机 Go 1.27.2 位于 `~/sdk/go1.27.2/bin`（不在默认 PATH）；`gofmt`、`go vet ./internal/auth/` 与 `go test ./internal/auth/` 通过，`auth_test.go` 不依赖具体时长。
