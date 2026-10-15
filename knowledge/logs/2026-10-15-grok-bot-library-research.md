# Grok Bot 接入库调研

日期：2026-10-15。范围：个人 Grok Bot 桌面应用（`com.anysphere.sand`）调用现有 Go 服务的图片处理、小红书能力。本文是选型建议与后续验证计划；未实施接入、安装新依赖或进行付费调用。

## 结论

优先使用 **`modelcontextprotocol/go-sdk`**，在现有 `net/http` 服务中注册工具、挂载 Streamable HTTP Handler，并使用 SDK 的 Bearer 认证中间件。保留现有业务服务与文件处理代码，仅写业务适配。先验证 Grok Bot 对标准图片内容和资源链接的支持，再决定是否需要额外文件接口；原计划中的通用 `fileId` 层、签名下载 URL 和上传脚本均改为条件项。

截至本次检查，[go.mod](../../apps/server/go.mod) 已包含未提交的 `go-sdk v1.7.0` 间接依赖。本次不改变它；正式实现按该版本 API 核对，不能用主分支新接口替代版本证据。

## 库与机制选择

| 候选 | 已有能力 | 本项目建议 |
| --- | --- | --- |
| [modelcontextprotocol/go-sdk v1.7.0](https://github.com/modelcontextprotocol/go-sdk/tree/v1.7.0) | 官方 SDK；Go 类型工具绑定、Schema、HTTP 传输、认证、资源与内容类型 | **首选**。当前需求均有现成协议机制，直接嵌入现有 Go 服务 |
| [mark3labs/mcp-go](https://github.com/mark3labs/mcp-go) | stdio、SSE、Streamable HTTP，HTTP Handler 可挂到现有路由，工具中间件等 | **可行备选**。没有发现当前需求必须依靠它才能完成的差异，切换收益不足 |
| [metoro-io/mcp-golang](https://github.com/metoro-io/mcp-golang) | 原生 Go 参数与自动 Schema；README 描述 HTTP 为无状态请求响应，stdio 完整支持双向功能 | **本轮不选**。其声明的传输侧重点没有提供优于首选的匹配理由；不据此断言不支持所有新协议 |
| [MCP Inspector](https://github.com/modelcontextprotocol/inspector) | 可视化与命令行 MCP 检查工具 | **开发时使用**。检查发现、Schema 和调用结果；不加入 Go 服务运行时，也不能代替 Grok Bot 验收 |

mark3labs 当前也有 [typed tools 示例](https://github.com/mark3labs/mcp-go/blob/main/examples/typed_tools/main.go)，因此不能把“需要手写所有 Schema”作为淘汰它的理由。选官方 SDK 是基于现有项目、所需功能与依赖收敛的工程判断。

## 直接复用 SDK 的部分

- **工具定义与验证：**用顶层泛型 `mcp.AddTool[In, Out]`；它能推断输入输出 Schema，执行输入解码、输入输出校验并包装普通工具错误。`Server.AddTool` 是较底层接口，职责不同。模型枚举、倍数与坐标范围应落实到 Schema 和已有业务校验，无须再写一套工具框架。[v1.7.0 工具文档](https://github.com/modelcontextprotocol/go-sdk/blob/v1.7.0/docs/server.md#tools)
- **HTTP 协议：**`NewStreamableHTTPHandler` 已实现 `http.Handler`；复用现有 Go 路由和部署。会话、协议消息与流式响应交给 SDK，按 Grok 实际协商版本选择选项。[v1.7.0 传输文档](https://github.com/modelcontextprotocol/go-sdk/blob/v1.7.0/docs/protocol.md#streamable-transport)
- **认证：**`auth.RequireBearerToken` 负责请求级 Bearer 验证和认证上下文，项目提供小型 `TokenVerifier` 校验个人服务凭据。凭据管理与撤销仍由项目负责；仅个人使用、且客户端接受静态 Bearer 时，无须引入完整 OAuth 服务。[认证 API](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk@v1.7.0/auth#RequireBearerToken)
- **结果内容：**优先测试 SDK 的 `ImageContent`、`ResourceLink` 和 `AddResource`/`ReadResource`。前者承载图片数据，资源链接描述 URI、MIME 和大小；它们提供协议表达，不提供业务文件存储和客户端附件转存保证。[内容类型 API](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk@v1.7.0/mcp#ImageContent)、[资源文档](https://github.com/modelcontextprotocol/go-sdk/blob/v1.7.0/docs/server.md#resources)

## 文件处理的边界

Grok 官方说明支持远程 HTTPS MCP 和凭据配置，也说明聊天支持图片输入与结果卡片，但没有在这些页面保证任意自定义 MCP 的 `ResourceLink` 都会自动变成可保存附件。[MCP 配置](https://docs.x.ai/grok-bot/team-bots#plugins)、[文件与结果](https://docs.x.ai/grok-bot/files-and-results)

因此，需要验证的是真实客户端行为：聊天图片是否向工具暴露可读来源、图片内容能否预览与保存、资源能否读取、ZIP 能否交付、下载是否能携带认证。服务端也不能读取 Bot 电脑上的本地路径。按官方文件页，桌面图片附件上限为 25 MB；现有服务的 30 MiB 上限无需因此全局修改，Bot 入口只描述可实际使用的限制。

| 文件需求 | 当前可复用 | 何时才增加库或服务 |
| --- | --- | --- |
| 小型上传和下载 | Go 标准库 `net/http`、`mime/multipart`、`io`；如客户端缺上传路径，只补受限上传 Handler | 出现明确断点续传需求才考虑 [tus/tusd](https://github.com/tus/tusd)，它是 resumable upload 服务，不是 MCP 附件桥 |
| ZIP | 已有 `internal/xhs/service.go` 使用标准库 `archive/zip` | 当前无新增归档库理由；[标准库 ZIP API](https://pkg.go.dev/archive/zip#NewWriter) 已满足打包 |
| 临时落盘 | 标准库 `os.CreateTemp`；是否需要保留文件取决于交付路径 | [CreateTemp](https://pkg.go.dev/os#CreateTemp) 不负责业务过期策略；若确需落盘，再补最小清理和容量约束 |
| 对象存储 | 当前个人单实例优先复用现有部署 | 明确需要跨实例、持久保存或对象存储时，再选供应商 SDK；[Go CDK blob](https://gocloud.dev/howto/blob/) 适合需要多后端统一 API 的场景，当前不预设引入 |

上传解析和限流可直接使用 [Request.MultipartReader 与 MaxBytesReader](https://pkg.go.dev/net/http#Request.MultipartReader)。用标准库处理基础 I/O 不属于另造上传协议；业务文件授权、留存时间和文件归属仍需应用决定。

## Grok Bot 回传与探针约定

2026-10-15 用户转交 Grok Bot 的答复。下列客户端能力来自该答复，尚未在本项目端点实测；其引用的内部技能和运行态未由本项目独立检查。

- **连接与认证：**Grok Bot 表示可通过 `AddMcpServer` 配置 HTTPS URL 与 `headers.Authorization`。首选独立静态 Bearer；Token 经客户端支持的安全配置入口交接，Skill 和普通聊天不保存明文凭据。服务端复用 SDK 中间件及小型 TokenVerifier。
- **OAuth 发现：**回传称 OAuth discovery 可能触发客户端忽略静态 headers。个人 Bearer 接入不发布 OAuth metadata，也不在 401 中声明 `resource_metadata`；这不影响现有 GitHub OAuth。该客户端问题属于回传信息，需用探针验证，不据此增加通用发现拦截机制。
- **图片输入：**回传称聊天附件落在 Bot 云端文件系统，并支持通过 `$file:` 注入字符串工具参数。先用小图验证 data URL 文件注入及较大图片参数传输；服务端不能直接使用 Bot 的本地路径。确认参数体积受限后才补 multipart 上传与文件引用。
- **结果交付：**先验证单图 `ImageContent` 与图片/ZIP 的 `resources/read`；ResourceLink 自动读取及附件展示仍待实测。普通 HTTPS 下载链接不假定继承 MCP 凭据；如需额外下载路径，再验证显式认证或文件级短期凭据。
- **耗时：**回传未给出单次 MCP 调用的硬超时。用免费、可取消且有时长上限的探针分别验证 120、180、300 秒以及进度通知。仅在现有业务耗时超过实测可用窗口时考虑异步任务。

探针仅提供连通测试、图片回传、测试 ZIP 资源和受限等待功能，不调用模型。访问记录包含方法、路径、认证结果和耗时，用以核对 initialize、tools/list、tools/call、resources/read；不记录 Authorization、Token、图片正文或完整工具参数。验收同时检查缺失/错误 Token 被拒、正确 Token 通过、轮换后旧 Token 失效。

## 收紧后的实施顺序与完成标准

1. **兼容探针：**用官方 SDK 提供无付费业务的测试工具，验证静态 Bearer、工具发现、`ImageContent`、资源链接/读取以及真实附件输入。完成标准是聊天中能打开、保存测试图片和 ZIP，并记录可用链路及超时行为。
2. **业务薄适配：**将已验证的传输方式接到现有去水印、放大与小红书服务，共享已有并发限制。完成标准是各工具和一次组合流程成功，既有 HTTP 行为保持一致。
3. **按缺口补文件接口：**仅当第 1 步证明需要，增加最小上传、临时文件或下载授权；`fileId` 只在跨工具复用确需服务端持有文件时加入。每项以具体失败用例及通过后的同一用例验收。
4. **工作流 Skill：**按 [writing-for-agents](/Users/asherliao/.agents/skills/writing-for-agents/SKILL.md) 的层级原则组织触发、步骤、分支与交付完成标准；参数事实留在工具 Schema，Skill 只写选择与操作规则。用 Grok Bot 真实任务验收，Inspector 只验证协议侧。

## 证据边界

已阅读版本化官方 SDK 文档、社区维护者仓库、Go 标准库文档与 xAI 官方客户端说明，并用 Context7 交叉核对 `go-sdk v1.7.0`，另纳入用户转交的 Grok Bot 答复并单独标注来源。结论是技术选型建议；Grok Bot 的文件兼容性和端到端可用性仍待实测。没有新增模型效果、线上稳定性或客户端兼容性结论。
