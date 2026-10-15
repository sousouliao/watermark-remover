# Go API

单独 Go module，入口 `cmd/server`。HTTP/日志/JSON/ZIP 使用标准库，生产直接依赖为 OAuth2、CORS 和官方 MCP Go SDK。

## 本地开发

安装 Go 1.27.2，复制 `.env.example` 为 `.env`，配置 GitHub OAuth（本地回调 `http://localhost:5173/auth/callback`，生产使用独立 OAuth App）。在仓库根运行 `pnpm start:server`，开发启动器加载 `.env`；Go 程序只读取进程环境。前端未设 `VITE_API_BASE_URL` 时使用 Vite 的 `/api` 代理。

```sh
go test ./...
go test -race ./internal/auth ./internal/xhs
go vet ./...
go build -o dist/server ./cmd/server
```

`server` 装配依赖、注册路由；`config` 校验配置；`httpapi` 处理少量 HTTP 共性。`auth`、`watermark`、`upscale`、`xhs` 按功能组织，上游 DTO 不暴露前端；`media` 负责受限下载和图片输入。测试与实现同包，用 httptest 模拟上游。

## 身份与兼容接口

下表网页业务接口需要 `Authorization: Bearer <本应用会话>`，不使用 GitHub token 调用业务 API。会话八小时过期、进程重启失效，退出立即撤销。只允许配置的 GitHub 固定 ID，默认 `37927306`。

| 路径 | 请求 | 行为 |
| --- | --- | --- |
| POST `/api/auth/github/start` | `{codeChallenge}` | 创建五分钟一次性 state，返回 `{authorizationUrl,state}` |
| POST `/api/auth/github/exchange` | `{code,state,codeVerifier}` | 验证 PKCE、GitHub 身份，返回 `{token,user,expiresAt}` |
| GET `/api/auth/me` | Bearer | 当前用户 `{id,login}` |
| POST `/api/auth/logout` | Bearer | 撤销当前会话 |
| POST `/api/watermark/remove` | 原有 `{image,model,mode,region?}` | 兼容原有 `{image,model}` |
| POST `/api/upscale` | `{image,scale?}` | Gradio 放大，返回 `{image}`，默认 2 倍 |
| GET `/api/health`、`/api/health/ready` | 无 | 进程存活；不表示全部外部服务可用 |

JSON 成功返回 `{success:true,data,timestamp}`，失败返回正确 HTTP 状态及 `{success:false,message,timestamp}`。图像输入最大 30MiB PNG/JPEG/WebP，JSON 请求最大 50MiB。去水印 120 秒、放大 180 秒上限；同一时刻仅一个图像处理请求，不自动重试或切换付费模型。

## 小红书下载

POST `/api/xhs/parse` 接收 `{text}`（最多 8192 字节的分享文本或 URL），每次仅一条公开图文笔记。保留分享参数，短链先经受限 HTTP 重定向解析；服务向 XHS-Downloader 仅传 url、download=false、check_record=false。

返回 `data` 为 `{resultId,note:{id,title,description,authorName},images:[{index,previewUrl,downloadUrl}],zipUrl,expiresAt}`；路径相对 API origin，图片序号从 1 开始。原资源地址、上游参数及分享 token 不返回浏览器。

- GET `/api/xhs/results/{id}/images/{index}`：图片，`?download=1` 使用附件响应。
- GET `/api/xhs/results/{id}/archive`：完整 ZIP，文件按 `01.jpg` 等顺序命名。
- 浏览器用带 Bearer 的 fetch 获取图片/ZIP Blob；不能直接用不携带认证的 img/a URL。
- 结果缓存仅保存元数据，30 分钟过期、最多 50 条；重启或淘汰返回 410，重新解析即可。
- 图片下载仅允许受限 HTTPS 域名，并校验重定向和实际连接 IP；单图 30MiB、80张/笔记、整包 150MiB。解析并发一个，媒体并发两个，超出返回 503。
- 请求临时文件完成、失败、取消均清理；ZIP 完成后才发送，失败不发送部分压缩包。当前未提供持久缓存、批量作者抓取或账号 Cookie 能力。

生产部署见根目录 `deploy/README.md`。

## Grok Bot MCP

可选 `/api/mcp` 使用独立 Bearer 凭据，提供去水印、放大、小红书解析和文件下载的异步任务工具，与网页共用业务服务及图像处理槽位。客户端分段查询并领取图片或 ZIP，大文件使用短期单文件下载链接。诊断工具默认关闭。配置、工具及客户端验收状态见 [MCP 说明](MCP.md)。
