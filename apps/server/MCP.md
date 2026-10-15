# Grok Bot 兼容探针

当前仅提供免费兼容探针，尚未开放去水印、放大或小红书业务工具。使用官方 `go-sdk v1.7.0`，入口为 `/api/mcp`，支持 Streamable HTTP，使用无状态模式和 SSE 响应。Grok Bot 首轮认证与图片附件回传已通过；原生长调用超时和资源读取入口存在限制，结果与实际连接方式见[实测记录](../../knowledge/logs/2026-10-15-mcp-probe.md#grok-bot-桌面首轮实测)。

## 启用与连接

1. 在仓库根生成专用随机 Token，原文保存到被 Git 忽略的文件，仅输出其 SHA-256 摘要：

   ```sh
   python3 - <<'PY'
   import hashlib, os, secrets
   from pathlib import Path
   folder = Path('.local/mcp-probe')
   folder.mkdir(parents=True, exist_ok=True, mode=0o700)
   token = secrets.token_urlsafe(32)
   target = folder / 'token'
   fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
   with os.fdopen(fd, 'w') as f:
       f.write(token)
   print('MCP_TOKEN_SHA256=' + hashlib.sha256(token.encode()).hexdigest())
   print('Token saved to ' + str(target.resolve()))
   PY
   ```

   已有 token 文件时命令会停止，避免误覆盖现有凭据。原文通过 Grok Bot 支持的安全凭据配置入口交接，不粘贴到普通聊天、Skill 或 URL。

2. 将输出的 `MCP_TOKEN_SHA256` 加到服务器 `/etc/watermark-api.env`，保持原有环境配置；部署本版二进制并重启 `watermark-api`。本地开发则添加到 `apps/server/.env`。空值关闭入口，非法摘要阻止服务启动。摘要不是客户端凭据。
3. 生产沿用现有 Nginx `/api/` 代理，不新增端口；已有 `proxy_buffering off` 和 330 秒读取超时。先验证既有 `/api/health`、网页业务接口仍受 GitHub 会话保护、无 Token 请求 MCP 得到 401；未启用时 MCP 返回 404。
4. 在 Grok Bot 中通过 `AddMcpServer` 配置连接，远程端点为 `https://43.138.214.93/api/mcp`，服务端要求 `Authorization: Bearer <原始 Token>`。本次客户端实际以云端 stdio 桥接 mcp-remote 引用安全卡保存的凭据；直接远程 headers 的安全注入未验收。若客户端需要本地认证文件，写入时使用 0600，聊天只报告权限与占位符，不报告内容。

服务端只保存摘要并恒定时间比较；认证复用 `auth.RequireBearerToken`，不发布 OAuth metadata，也不在 401 中声明 `resource_metadata`。GitHub 登录路径不变。撤销或轮换时替换摘要并重启，再更新连接器。清空摘要并重启可关闭探针。

## 验收顺序

每一步取得规定结果后再进入下一步；失败时保留失败步骤和服务端认证结果。测试均不调用外部服务。

| 步骤 | 调用 | 完成条件 |
| --- | --- | --- |
| 连接 | 发现工具，调用 `probe_ping` | 返回 `status: ok`；服务端记录握手、工具发现与调用 |
| 固定输出 | 调用 `probe_test_files` | 返回渐变 PNG 的 ImageContent，以及 PNG/ZIP ResourceLink；记录是否自动展示/读取 |
| 资源读取 | `resources/read` 读取返回的两个 URI | PNG 可打开；ZIP 可完整解压，内含 `image.png`、`README.txt`；Bot 能作为聊天附件交付 |
| 图片输入 | 上传自己的测试图片，将完整 base64 data URL 作为 `probe_echo_image.image` 传入 | 返回原始图片，`sha256`、`bytes` 与输入一致；Bot 能保存原始结果文件 |
| 参数体积 | 同样方式传较大测试图片 | 无截断；记录实际字节数。遇到客户端体积限制才增加上传适配 |
| 耗时 | 依次调用 `probe_wait`，`seconds` 为 120、180、300 | 记录完成/超时时长；调用携带 progress token 时每 10 秒发进度；记录客户端是否显示 |
| 取消 | 运行等待后在客户端取消，再调用一次短等待 | 记录取消传播和槽位释放；新协议绑定 HTTP 取消，旧协议行为需实测 |
| 认证 | 用缺失、错误 Token 连接，再轮换 Token | 无效凭据均被拒，轮换后旧 Token 失效 |

资源 URI 为 `watermark-probe://test/image.png`、`watermark-probe://test/archive.zip`，必须通过 MCP 资源读取，不能作为普通 HTTP 地址打开。Grok Bot 若不支持主动资源读取，记录具体缺口，之后再补交付适配。

`probe_echo_image` 复用现有 PNG/JPEG/WebP data URL 校验，图片最大 30 MiB；HTTP 请求体上限 50 MiB。Grok Bot 自身附件与工具参数大小限制另行实测。文件参数接收文件内容，服务端不能读取 Bot 云端电脑的本地路径；客户端 `$file:` 注入需先在云端生成 data URL 文件，再注入其内容，避免模型展开整段 Base64。

等待仅允许 0–300 秒、同时一个请求；超限和繁忙立即返回工具错误。所有等待均受上下文和 310 秒上限约束。失败后按实际错误决定下一步，不自动循环重试。协议协商、SSE 与进度封装交给 SDK。

## 诊断与验证范围

现有 HTTP 日志记录方法、路径、状态和耗时；MCP 方法日志记录方法名、认证通过与耗时，用于核对 `initialize`（新协议为 `server/discover`）、`tools/list`、`tools/call`、`resources/read`。日志不记录 Token、Authorization、图片或完整工具参数。尚未通过认证的 HTTP 请求由 401 状态识别。

本地针对性验证：

```sh
cd apps/server
go test -race ./internal/mcpprobe ./internal/config ./internal/server
go vet ./internal/mcpprobe ./internal/config ./internal/server
```

上述测试覆盖官方 SDK HTTP 客户端的工具发现与调用、图片字节与摘要、PNG/ZIP 资源完整性、认证及配置关闭、等待取消、旧协议初始化和网页认证隔离；不替代 Grok Bot 实测，也不代表 120/180/300 秒已在真实客户端通过。
