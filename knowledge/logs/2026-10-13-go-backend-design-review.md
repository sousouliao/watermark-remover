# Go 后端库与代码组织核对

日期：2026-10-13。状态：设计调研完成，尚未迁移产品代码。

## 结论与依据

用户已接受 Vue/Vercel + Go/腾讯云分离部署，并要求代码优雅、合理、整洁。当前 NestJS 后端只有去水印、放大和健康检查；新增 GitHub 登录及 XHS 解析、下载、ZIP 后仍属于小型单服务。建议使用标准 `net/http`，只增加 OAuth2 和 CORS 两项生产直接依赖。

| 需求 | 选择 | 原因 |
| --- | --- | --- |
| HTTP 路由 | `net/http.ServeMux` | Go 1.22 起支持方法、路径参数及自动 405，足够覆盖计划接口；不是要求使用旧版 Go 1.22。[官方说明](https://go.dev/blog/routing-enhancements) |
| GitHub OAuth | `golang.org/x/oauth2` | 官方扩展包提供授权码交换、PKCE 随机 verifier、S256 challenge 和 verifier 参数；`github.Endpoint` 提供端点。[包文档](https://pkg.go.dev/golang.org/x/oauth2)、[GitHub 端点](https://pkg.go.dev/golang.org/x/oauth2/github) |
| 跨域 | `github.com/rs/cors` | 直接包装标准 Handler，处理预检及 Vary；显式配置精确正式来源、GET/POST、Authorization/Content-Type，Bearer 方案不启用 Cookie credentials，不用默认全来源配置。[项目文档](https://pkg.go.dev/github.com/rs/cors) |
| 日志 | `log/slog` | 已有 JSON/Text handler；记录请求路径、状态、耗时和上游错误分类，不记录密钥或含 token 的完整 URL。[标准库文档](https://pkg.go.dev/log/slog) |
| JSON/ZIP/测试 | `encoding/json`、`archive/zip`、`testing` + `httptest` | 标准库已覆盖当前需求，无需绑定库、ZIP 库或 mock 框架。[ZIP](https://pkg.go.dev/archive/zip)、[HTTP 测试](https://pkg.go.dev/net/http/httptest) |

`chi` 是兼容 `net/http` 的优秀轻量路由器，提供分组、子路由和中间件组合；当前路由数量及权限分组可直接用 ServeMux 与认证 Handler 包装表达，没有必要同时维护两种路由抽象。[chi 项目说明](https://github.com/go-chi/chi)

GitHub 当前文档支持并建议 PKCE 的 `S256`，授权码交换要求相同 verifier。使用库不替代随机 state 的关联、过期和单次消费，也不替代 GitHub 用户 ID 白名单；这些仍属于本应用业务规则。[GitHub OAuth 文档](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)

## 目录与职责

建议在 `apps/server` 单独设 Go module。目录按功能组织，测试与实现同包；`cmd` 放入口，`internal` 放服务实现，符合官方服务器项目建议。[官方布局指南](https://go.dev/doc/modules/layout)

```text
apps/server/
  go.mod / go.sum
  cmd/server/main.go       # 启动、信号、退出码
  internal/
    server/               # 组装依赖、路由、中间件、优雅关闭
    config/               # 环境变量读取、启动校验
    httpapi/              # 少量 JSON 响应、错误与请求大小限制
    auth/                 # GitHub 登录、state、会话、认证中间件
    watermark/            # 模型/区域规则与 Ark 客户端
    upscale/              # 放大流程与特定 Space 的 Gradio 客户端
    xhs/                  # 解析响应适配、结果缓存、图集及 ZIP 流程
    media/                # 受限媒体下载；XHS/Gradio 确有共享时抽取
```

- Handler 只处理 HTTP 输入输出、调用业务方法、映射错误；service 仅在需要编排/业务规则时存在；client 负责上游协议、HTTP 请求及返回适配。无需每个功能机械生成三层。
- 外部响应 DTO 留在相应 client 内部；对浏览器的 DTO 放在功能包，避免上游字段扩散。不要建设统一 `models`、`utils` 或泛型仓储包。
- 使用显式构造函数传配置、HTTP client、日志和时钟；在 server 中装配，不使用 DI 容器。默认具体类型；只有实际替身/变化边界才在使用方定义窄接口。
- 全链路传递 `context.Context`；请求取消与上游超时沿用请求上下文。HTTP client/transport 复用，不按请求重复建连接池。[Context](https://pkg.go.dev/context)、[HTTP client](https://pkg.go.dev/net/http#Client)
- 会话与 XHS 缓存各自封装带锁 map、TTL 和容量上限；按访问惰性删除过期条目即可，不先建设通用 cache 或 Redis。并发限制使用固定容量 channel，能在 context 取消时退出。
- 依赖版本在实现时按已支持的 Go 工具链锁定到 go.mod/go.sum；不使用未经验证的 latest 运行时安装。需要保留本地 `.env` 体验时复用开发启动命令加载，或选 godotenv 开发工具；生产用 systemd 环境文件，不自写 `.env` 解析器。

## 对上一版方案的收紧

1. 不把“全标准库”当目标：授权码交换/PKCE 与 CORS 用已有小库，避免自写协议；其他需求标准库即可。
2. 不再把 ZIP 制作为“先存所有原图，再存 ZIP”：逐张有界下载并写入一个请求专属临时 ZIP，全部写入且 Close 成功后才发送。失败/取消时删除文件，降低磁盘重复占用并保留完整包保证。
3. Gradio 只实现当前 Space 确认的上传、任务结果和下载流程，避免通用 Gradio SDK；不同时引入 Ark 全量 SDK 与手写同一协议。
4. 不为每个模块建设 controller/service/repository/interface/model 目录；健康检查等简单 Handler 无需空 service。
5. HTTP 错误对外保持当前可读 message；内部用 Go error wrapping 和必要的可判别错误，避免上游原始错误/凭证直接回给前端。
6. GOMEMLIMIT 是运行时软内存目标，不能将其称为宿主 Go 的硬保护上限；如要硬上限，部署用 systemd/cgroup 的 MemoryMax。[运行时说明](https://pkg.go.dev/runtime/debug#SetMemoryLimit)

## 定向验证

- Handler 测试用 Recorder 检查现有 JSON 契约、非法输入、HTTP 状态、Bearer 身份及 CORS 预检；不用专门 mock HTTP 包。
- client 测试用 `httptest.Server`/TLS server 模拟 Ark、Gradio、GitHub 和 XHS，验证实际请求、非 2xx、无效响应、超时和取消，不消耗付费模型调用。
- ZIP 测试读取结果包，确认文件数量、内容和失败时无完整包；媒体用受控地址/重定向与容量测试，临时目录由 `t.TempDir` 管理。
- 有共享会话/结果缓存，针对相应包执行 race 检查；执行 `go test`、`go vet`、前端类型检查与构建，再按既定真实业务验收一次，不升级为全面审计。

本记录是实施建议；实际 Go 版本、锁定依赖及验收结果留在迁移实施记录。现有产品与架构契约仍描述已实现的 NestJS 状态。
