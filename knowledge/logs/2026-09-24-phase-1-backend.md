# 2026-09-24 · 阶段 1：方舟双模型后端

按 Issue #2 将 `/api/watermark/remove` 改为接收图片 data URI、明确的 `lite` / `flash` 模型和 `direct` / `region` 模式。区域模式使用 0–999 坐标 `<bbox>` 提示；服务端统一调用方舟图片生成接口，请求 2K PNG Base64、关闭新增水印，返回图片 data URI 和实际选择的模型。API Key 和两个接入点从服务端环境变量读取；不自动重试或切换付费模型。

服务层区分输入错误、配置缺失、鉴权失败、上游繁忙、超时与无有效图片；不向调用方暴露上游响应体。新增聚焦测试覆盖两模型请求、区域坐标、鉴权失败、超时和空图片响应。`pnpm -F @watermark-remover/server build`、`pnpm -F @watermark-remover/server test -- --runInBand watermark.service.spec.ts` 和水印模块 ESLint 检查通过。

真实后端验收：用户明确授权后，从现有 Ark CLI 本地凭证向一次性测试进程注入 API Key；没有打印或保存密钥，也没有创建项目 `.env`。用 `samples/phase0/19-marked.jpg` 分别向本地运行的 `/api/watermark/remove` 提交 `model=lite` 和 `model=flash`、`mode=direct`。两次均返回 HTTP 200、正确模型字段和 PNG data URI；解码图片分别为 4,341,880 与 4,245,407 字节。一次性脚本已删除。阶段 1 的真实双模型调用验收完成。前端改造属于 Issue #3，当前页面还发送旧请求格式。
