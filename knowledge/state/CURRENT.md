# 当前状态

更新：2026-10-11

## 所处阶段

阶段 0 [Issue #1](https://github.com/sousouliao/watermark-remover/issues/1) 的 API 核对和样本评测已完成。阶段 1 [Issue #2](https://github.com/sousouliao/watermark-remover/issues/2) 的后端双模型接口已通过真实调用验收。阶段 2 [Issue #3](https://github.com/sousouliao/watermark-remover/issues/3) 的前端已接入模型选择、直接/指定区域处理、结果对比、重试与下载，并通过四条真实页面路径验收。阶段 3 [Issue #4](https://github.com/sousouliao/watermark-remover/issues/4) 的旧实现核对、五张代表样本的 20 次产品接口复核和本地构建已完成；页面[默认 Lite](../decisions/0002-default-seedream-lite.md)，Flash 仍可选。

## 下一步

确认目标部署环境后，按 `apps/server/.env.example` 配置服务端密钥和两模型接入点，并在该环境验收上传、处理、对比、下载。当前仓库没有部署配置或目标地址；本地实施和复核见[阶段 3 记录](../logs/2026-09-24-phase-3-delivery.md)。

## 当前未确认

- 目标部署环境及其接入方式尚未提供，因此目标环境的完整流程未验收。

## 小红书下载验证

独立 HTTP 探针已实现；第一轮 5 条真实长链接均跳转登录页。追加匿名浏览器对照后，已取得其中两条笔记的完整图集并下载 9 张候选 JPEG（另有 9 张预览），全部完整解码，本轮视觉检查未发现平台附加的可见水印。本机浏览器解析与媒体下载链路具备可行性，单图、短链、其他样本及腾讯云仍未验收，未新增产品功能。证据、限制及下一步见[浏览器对照记录](../logs/2026-10-11-xhs-browser-validation.md)。

用户进一步要求核对登录前后画质与风控；[同图对照](../logs/2026-10-11-xhs-login-comparison.md)已确认两笔记 9 张候选图片的资源地址及下载文件逐字节一致，登录没有提高这批样本在本项目下载方式下的画质。两种访问均不能保证不受限制，风险证据见[调研记录](../logs/2026-10-11-xhs-resolution-risk-research.md)。

追加[社区解析路线调研](../logs/2026-10-11-xhs-parser-options.md)后，不直接将 Playwright 定为云端方案。[XHS-Downloader 接入评估](../logs/2026-10-11-xhs-downloader-integration-review.md)确认现有 API 适合单笔记解析，建议优先固定版本试接独立内网服务，再做腾讯云复验；TLS 校验、响应适配和真实样本仍需验收。尚未安装或接入上游，未引入账号 Cookie、浏览器依赖或第三方解析服务。
