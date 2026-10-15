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

`server` 装配依赖、注册路由；`config` 校验配置；`httpapi` 处理少量 HTTP 共性。`auth`、`watermark`、`upscale`、`xhs`、`douyin` 按功能组织，上游 DTO 不暴露前端；`media` 负责受限下载和图片输入。测试与实现同包，用 httptest 模拟上游。

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

POST `/api/xhs/parse` 接收 `{text}`（最多 8192 字节的分享文本或 URL），每次仅一条公开图文或视频笔记。保留分享参数，短链先经受限 HTTP 重定向解析；服务向 XHS-Downloader 仅传 url、download=false、check_record=false。

返回 `data` 为 `{resultId,note:{id,title,description,authorName},mediaType:"images"|"video",images:[{index,previewUrl,downloadUrl}],zipUrl,expiresAt}`；路径相对 API origin，图片序号从 1 开始。原资源地址、上游参数及分享 token 不返回浏览器。

- GET `/api/xhs/results/{id}/images/{index}`：图片，`?download=1` 使用附件响应。
- GET `/api/xhs/results/{id}/archive`：完整 ZIP，文件按 `01.jpg` 等顺序命名。
- 视频结果返回空 `images`、`video:{previewUrl,downloadUrl}`，不返回 `zipUrl`；图文结果保留 `zipUrl`。
- GET `/api/xhs/results/{id}/video`：原字节 MP4，支持 Range 与 `?download=1` 附件下载。单视频 150 MiB、下载超时 5 分钟，与图片共用下载槽位；类型不匹配的下载会失败。
- 浏览器用带 Bearer 的 fetch 获取图片/视频/ZIP Blob；不能直接用不携带认证的 img/a URL。
- 结果缓存仅保存元数据，30 分钟过期、最多 50 条；重启或淘汰返回 410，重新解析即可。
- 图片下载仅允许受限 HTTPS 域名，并校验重定向和实际连接 IP；单图 30MiB、80张/笔记、整包 150MiB。解析并发一个，媒体并发两个，超出返回 503。
- 请求临时文件完成、失败、取消均清理；ZIP 完成后才发送，失败不发送部分压缩包。当前未提供持久缓存、批量作者抓取或账号 Cookie 能力。

## 抖音解析与下载

`DOUYIN_API_URL` 默认 `http://127.0.0.1:5555`，必须为 loopback IP 的 HTTP(S) origin（允许 `127.0.0.1` / `[::1]`，不接受域名、凭据、路径或查询参数）。独立 DouK-Downloader 使用 5555，XHS 继续使用 5556。Go 调用 DouK 不经过环境代理、不跟随上游重定向，不接收或转发客户端 Cookie/proxy。

- POST `/api/douyin/parse`：`{text}`，最多 8192 字节、一次一条公开作品。支持 `v.douyin.com` 短链、`www.douyin.com` 的 note/video/slides 或 user + modal_id，以及 `www.iesdouyin.com/share/{note|video|slides}/{id}`；作品 ID 为 19 位数字。
- 成功 `data`：`{resultId,item:{id,title,description,authorName},mediaType:"images"|"video",images:[{index,previewUrl,downloadUrl}],zipUrl,expiresAt}`。DouK 只提供描述，`title` 和 `description` 均映射自 `desc`。所有媒体 URL 为本应用相对路径，不暴露 CDN 地址或上游参数。
- GET `/api/douyin/results/{id}/images/{index}`：从 1 开始；`?download=1` 返回附件。
- GET `/api/douyin/results/{id}/archive`：完整图集 ZIP。
- 上述接口与 XHS 使用相同 GitHub 会话认证、错误封装和下载语义；缓存 30 分钟/50 条、最多 80 张，解析并发 1、下载并发 2；单图 30 MiB、整包 150 MiB，解析超时 90 秒、单图请求 25 秒、整包 5 分钟。限额由 HTTP/MCP 共用的同一个抖音服务实例执行。
- 上游 `type=图集` 映射为 `mediaType=images`；`type=视频` 的 `downloads` 字符串映射为 `mediaType=video`，返回空 `images`、`video:{previewUrl,downloadUrl}`，不返回 `zipUrl`。实况及其他类型仍返回 422。
- GET `/api/douyin/results/{id}/video`：与小红书同等的 MP4 原文件、Range、附件下载及 150 MiB/5 分钟限制。
- 网页统一使用“链接解析”入口，自动识别小红书或抖音链接，复用图片列表、ZIP、视频预览和下载组件；不会自动调用 Seedream。

契约已逐项核对 [DouK 5.8 stable 路由源码](https://github.com/JoeanAmier/TikTokDownloader/blob/473c90ff70c663cfb69310fff2b8d5192f200661/src/application/main_server.py)、[响应模型](https://github.com/JoeanAmier/TikTokDownloader/blob/473c90ff70c663cfb69310fff2b8d5192f200661/src/models/response.py) 和 [数据提取器](https://github.com/JoeanAmier/TikTokDownloader/blob/473c90ff70c663cfb69310fff2b8d5192f200661/src/extract/extractor.py)：短链向 `/douyin/share` 仅提交 `{text:已校验URL}`，读顶层 `url` 并重新校验作品链接；长链直接提取 ID；向 `/douyin/detail` 仅提交 `{detail_id,source:false}`，读 `data.id/desc/nickname/type/downloads`。上游未取到数据返回 422；协议、ID 或媒体地址异常返回 502；本机解析服务不可达返回 502，超时返回 504。模拟上游测试验证了这些字段及下载流程，尚未验证真实样本或生产部署。

**CDN 策略与待验证项**：没有可用现场样本，本阶段保守限定 HTTPS 的图片 `*.douyinpic.com` 和视频 `*.douyinvod.com` 子域，作为可审查的初始域族策略，不能视作真实 host 已验收。复用 `media.Client`：每跳检查域名、仅 443、无 URL 凭据、关闭代理、DNS 解析全部为公网 IP 后直接拨号，并检查图片/MP4 签名与实际字节。未知域返回 502；TODO：上线前用真实图集及视频确认最终 host、重定向和 PNG/JPEG/WebP 下载，若需扩展域族，先留下脱敏 host 与来源证据并补 allowlist 测试，禁止为兼容而放开任意 CDN。

生产部署见根目录 `deploy/README.md`。

## Grok Bot MCP

可选 `/api/mcp` 使用独立 Bearer 凭据，提供去水印、放大、小红书/抖音图片与视频解析和文件下载的异步任务工具，与网页共用业务服务及图像处理槽位。客户端分段查询并领取图片、视频或 ZIP，大文件使用短期单文件下载链接。诊断工具默认关闭。配置、工具及客户端验收状态见 [MCP 说明](MCP.md)。
