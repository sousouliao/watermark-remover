# 当前状态

更新：2026-10-13

## 所处阶段

阶段 0 [Issue #1](https://github.com/sousouliao/watermark-remover/issues/1) 的 API 核对和样本评测已完成。阶段 1 [Issue #2](https://github.com/sousouliao/watermark-remover/issues/2) 的后端双模型接口已通过真实调用验收。阶段 2 [Issue #3](https://github.com/sousouliao/watermark-remover/issues/3) 的前端已接入模型选择、直接/指定区域处理、结果对比、重试与下载，并通过四条真实页面路径验收。阶段 3 [Issue #4](https://github.com/sousouliao/watermark-remover/issues/4) 的旧实现核对、五张代表样本的 20 次产品接口复核和本地构建已完成；页面[默认 Lite](../decisions/0002-default-seedream-lite.md)，Flash 仍可选。

## Go 迁移与分离部署

用户已确认 Go 统一后端、Vercel 前端、公网 IP HTTPS 和仅允许 GitHub ID 37927306 的登录。Go 迁移及下载后端、前端登录、部署配置已实现，本地 Go race 测试/vet、前端构建/类型检查与改动文件 lint 已通过。前端已发布 https://watermark-remover-rose-chi.vercel.app；Go 尚未部署，服务器 pending 配置已保存但未安装。

## React 前端迁移

`apps/web` 已完成 PASS 1、PASS 2 与 PASS 3，并完成向 beUI (beui.dev) 交互动效规范与黑白极简工作室设计（Monochrome Studio）的全面重构：
1. 彻底淘汰原有的紫色调（`hsl(243, 75%, 59%)` 及各类 purple/violet 散落类），全站贯彻**纯黑白极简单色调**与**严格零阴影 (Zero-Shadow)**；
2. 基础组件全面替换为 beUI 原生组件：`RangeSlider`（物理弹簧与手势捕获）、`Card`（组合式 parts 与 interactive 缩放）、`Loader`（17 种高拟真动画变体）、`Input`（错误抖动与状态反馈）、`MotionButton` / `StatefulButton`（字符流动动画）、`Alert`（Animated Alert 弹性进退场）；
3. 顶栏右侧重构：主题切换置于左侧并接入 beUI `ActionSwapIcon` 原地流转，头像与登录名组成整体胶囊，点击弹出 Spring 动效下拉菜单；
4. 前端类型检查、生产构建及 ESLint 校验全部 0 错误通过，详见[beUI 重构记录](../logs/2026-10-13-beui-monochrome-redesign.md)。真实 OAuth、模型和放大服务仍需与 Go 后端联调验收。

## 下一步

以固定 Git 提交交付完整源码，完成服务器 Go/systemd、Nginx/IP 证书与续期，安装 pending 配置后验收真实 GitHub 登录、双模型/区域处理、放大及 Go 小红书单图/ZIP。源码包传递截断是本次实际部署阻塞；不能将前端发布和 Python 解析器历史成功标记整体上线。详见[实施记录](../logs/2026-10-13-go-api-migration.md)。

## 小红书下载验证

独立 HTTP 探针已实现；第一轮 5 条真实长链接均跳转登录页。追加匿名浏览器对照后，已取得其中两条笔记的完整图集并下载 9 张候选 JPEG（另有 9 张预览），全部完整解码，该轮视觉检查未发现平台附加的可见水印。本机浏览器解析与媒体下载链路具备可行性；后续云端验证见下文，单图、短链仍未验收，未新增产品功能。历史证据见[浏览器对照记录](../logs/2026-10-11-xhs-browser-validation.md)。

用户进一步要求核对登录前后画质与风控；[同图对照](../logs/2026-10-11-xhs-login-comparison.md)已确认两笔记 9 张候选图片的资源地址及下载文件逐字节一致，登录没有提高这批样本在本项目下载方式下的画质。两种访问均不能保证不受限制，风险证据见[调研记录](../logs/2026-10-11-xhs-resolution-risk-research.md)。

追加[社区解析路线调研](../logs/2026-10-11-xhs-parser-options.md)后，不直接将 Playwright 定为云端方案。[XHS-Downloader 接入评估](../logs/2026-10-11-xhs-downloader-integration-review.md)确认现有 API 适合单笔记解析。2026-10-13 机主回传：XHS-Downloader 2.8 独立容器已在腾讯云部署并通过启动验收，仅绑定 `127.0.0.1:5556`，三处 TLS 补丁命中，512 MiB/1 CPU 限制生效。追加三条真实图文长链接验证：匿名解析均成功，10/10 张候选 JPEG 下载且完整解码，解析耗时 4.4–6.9 秒，内存约 89→92 MiB，无 OOM、重启 0 次。附带联系图中未发现明显平台附加可见水印，该视觉判断限于缩略图，不能保证作者原文件或隐藏水印。部署过程及证据边界见[部署记录](../logs/2026-10-13-xhs-deployment-review.md)。云端 Python 候选链路已通过这批样本验证；Go 响应适配及下载后端现已实现并通过本地测试，尚未在云端 Go 服务验收。单图、短链、并发及长期稳定性未验收，未引入账号 Cookie 或浏览器依赖。
