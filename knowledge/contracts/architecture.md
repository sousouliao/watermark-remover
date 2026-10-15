# 架构契约

## 当前实现

- `apps/web`：原地迁移为 React 19 + Vite SPA（非 TanStack Start），使用 TanStack Router 文件路由、TanStack Query、Zustand 5、Tailwind 4、beUI (beui.dev) 动画/交互规范（基于 `motion`）与 Radix React primitives。UI 全面采用黑白极简单色调（纯黑与纯白，无彩色高饱和侵染），应用壳、GitHub PKCE 登录、水印业务页、模型/模式切换（Spring Tabs）、动作栏（StatefulButton）、对比预览与 hooks 均已迁移并完成重构；记录见 [beUI 重构记录](../logs/2026-10-13-beui-monochrome-redesign.md)。
- `apps/server`：Go 1.27.2 + `net/http`，保留 `/api/watermark/remove` 的方舟 Lite / Flash 请求与成功响应，图片放大改为 Gradio HTTP 调用；新增 GitHub OAuth/PKCE 和小红书解析、单图、ZIP 接口。Go 迁移已通过本地测试；2026-10-15 用户确认 Go 后端云端部署与真实联调已完成，无问题，见[实施记录](../logs/2026-10-13-go-api-migration.md)。
- React 功能实现已接入原有请求格式：直接模式传原图，指定区域模式将原图尺寸下的笔画转换为 0–999 的区域框；结果页显示实际模型并提供对比、返回编辑、重试与下载。

## 重构目标

```text
React SPA（选择模型、直接处理或指定区域、查看结果）
  → Go API（GitHub 身份、校验、模型映射、错误和结果转换）
  → 火山方舟 Seedream 5.0 Lite / Flash
```

- 前端只使用本项目 API；火山方舟 API Key 留在服务端。
- 后端向前端提供统一的去水印请求与响应；两款模型的上游差异由服务端处理。
- 模型选择由用户请求明确给出；服务端只允许配置中的 Lite 和 Flash，不静默切换到另一付费模型。
- 区域标记如何转为上游输入，以实际验证的方舟接口为准。只有确认生成图与原图尺寸、位置和边缘对齐时，才进行局部合成。
- 保留 Monorepo，React SPA 原地替换 Vue 3，Go 替换 NestJS。前端在 Vercel，Go 以 systemd 在腾讯云运行，Nginx/Certbot 提供公网 IP HTTPS；解析器保留既有独立容器，仅供 Go 本机调用。
- GitHub 登录仅接受固定用户 ID，生产默认 `37927306`。业务接口全部验证本应用 Bearer 会话；GitHub Client Secret、方舟密钥与 GitHub 上游 token 不交给浏览器。CORS 精确匹配正式前端 origin。
- 小红书由 Go 适配 XHS-Downloader 2.8 API，固定匿名解析参数，不开放账号 Cookie/proxy。结果元数据缓存 30 分钟、最多 50 条，媒体经受限 HTTPS 下载；单图和 ZIP 完成后交付，临时文件清理。接口规范见 `apps/server/README.md`。
- 当前生产直接依赖为 `golang.org/x/oauth2`、`github.com/rs/cors` 与 `github.com/modelcontextprotocol/go-sdk`；按功能组织 internal 包，显式装配依赖。
- 可选 `/api/mcp` 使用独立 Bearer 服务凭据，与网页 GitHub 会话隔离，无配置时关闭；协议与认证复用官方 Go SDK。MCP 与 HTTP 共用业务服务和图像处理槽位，异步任务以 requestId 去重、返回 jobId、分段查询并领取文件，任务及文件有界且随进程重启失效。小图/ZIP 提供协议内容，所有文件提供短期单文件签名下载链接；图片原文件交付通过下载链接避免宿主重编码。诊断工具由独立开关控制，默认关闭。配置见 [MCP 说明](../../apps/server/MCP.md)，边界与取舍见[异步任务决策](../decisions/0004-mcp-async-tasks-and-files.md)，客户端验收状态见[实施记录](../logs/2026-10-15-mcp-business.md)。

这里记录目标边界；实际调用字段和阶段顺序见[路线图](../roadmap.md)，以代码实现和实测结果更新。
