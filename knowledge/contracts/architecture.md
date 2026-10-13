# 架构契约

## 当前实现

- `apps/web`：Vue 3 页面负责上传、蒙版编辑、结果对比和下载。
- `apps/server`：Go 1.27.2 + `net/http`，保留 `/api/watermark/remove` 的方舟 Lite / Flash 请求与成功响应，图片放大改为 Gradio HTTP 调用；新增 GitHub OAuth/PKCE 和小红书解析、单图、ZIP 接口。Go 迁移已通过本地测试；云端 Go/HTTPS 与真实业务验收尚未完成。
- 前端已接入新请求格式：直接模式传原图，指定区域模式将原图尺寸下的笔画转换为 0–999 的区域框；结果页显示实际模型并提供对比、返回编辑、重试与下载。

## 重构目标

```text
Vue Web（选择模型、直接处理或指定区域、查看结果）
  → Go API（GitHub 身份、校验、模型映射、错误和结果转换）
  → 火山方舟 Seedream 5.0 Lite / Flash
```

- 前端只使用本项目 API；火山方舟 API Key 留在服务端。
- 后端向前端提供统一的去水印请求与响应；两款模型的上游差异由服务端处理。
- 模型选择由用户请求明确给出；服务端只允许配置中的 Lite 和 Flash，不静默切换到另一付费模型。
- 区域标记如何转为上游输入，以实际验证的方舟接口为准。只有确认生成图与原图尺寸、位置和边缘对齐时，才进行局部合成。
- 保留 Vue 3 和 Monorepo，Go 替换 NestJS。前端在 Vercel，Go 计划以 systemd 在腾讯云运行，Nginx/Certbot 提供公网 IP HTTPS；解析器保留既有独立容器，仅供 Go 本机调用。
- GitHub 登录仅接受固定用户 ID，生产默认 `37927306`。业务接口全部验证本应用 Bearer 会话；GitHub Client Secret、方舟密钥与 GitHub 上游 token 不交给浏览器。CORS 精确匹配正式前端 origin。
- 小红书由 Go 适配 XHS-Downloader 2.8 API，固定匿名解析参数，不开放账号 Cookie/proxy。结果元数据缓存 30 分钟、最多 50 条，媒体经受限 HTTPS 下载；单图和 ZIP 完成后交付，临时文件清理。接口规范见 `apps/server/README.md`。
- 当前生产直接依赖为 `golang.org/x/oauth2` 与 `github.com/rs/cors`，其余采用标准库；按功能组织 internal 包，显式装配依赖。

这里记录目标边界；实际调用字段和阶段顺序见[路线图](../roadmap.md)，以代码实现和实测结果更新。
