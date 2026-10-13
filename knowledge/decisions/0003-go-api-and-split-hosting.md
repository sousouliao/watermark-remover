# 0003：Go API 与前后端分离部署

日期：2026-10-13。状态：用户已确认；代码已实现，本地验证通过，云端整体验收进行中。

前端保持 Vue/Vite，部署 Vercel；Go 替换 NestJS，部署既有腾讯云服务器。保留双模型去水印和图片放大，新增小红书完整下载后端，本轮不增加小红书页面。

选择标准 net/http，OAuth2 与 CORS 采用两个专用库。按功能组织 internal 包，显式装配；不引入 Web 框架、ORM、DI 容器、数据库或通用缓存。会话与笔记结果使用有界进程内存储，服务重启后重新登录/解析，符合当前仅机主自用的范围。

机主没有域名，决定使用 Vercel 默认域名与服务器公网 IP 的可信 HTTPS；IP 短期证书自动续期为上线门槛。GitHub 固定 ID 37927306 为唯一允许身份，采用 OAuth/PKCE 与本应用 Bearer 会话以避免第三方 Cookie 依赖。

解析器保留同机独立 XHS-Downloader 2.8 容器。Go 负责适配、受限媒体下载和 ZIP，ZIP 逐图写单个临时压缩包，完整完成后发送。

依据：[Go 设计核对](../logs/2026-10-13-go-backend-design-review.md)、[解析器部署与样本验证](../logs/2026-10-13-xhs-deployment-review.md)。实际迁移和验证见[实施记录](../logs/2026-10-13-go-api-migration.md)。
