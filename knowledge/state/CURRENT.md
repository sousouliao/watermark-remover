# 当前状态

更新：2026-10-15

## 所处阶段

阶段 0 [Issue #1](https://github.com/sousouliao/watermark-remover/issues/1) 的 API 核对和样本评测已完成。阶段 1 [Issue #2](https://github.com/sousouliao/watermark-remover/issues/2) 的后端双模型接口已通过真实调用验收。阶段 2 [Issue #3](https://github.com/sousouliao/watermark-remover/issues/3) 的前端已接入模型选择、直接/指定区域处理、结果对比、重试与下载，并通过四条真实页面路径验收。阶段 3 [Issue #4](https://github.com/sousouliao/watermark-remover/issues/4) 的旧实现核对、五张代表样本的 20 次产品接口复核和本地构建已完成；页面[默认 Lite](../decisions/0002-default-seedream-lite.md)，Flash 仍可选。

## Go 迁移与分离部署

用户已确认 Go 统一后端、Vercel 前端、公网 IP HTTPS 和仅允许 GitHub ID 37927306 的登录。Go 迁移及下载后端、前端登录、部署配置已实现，本地 Go race 测试/vet、前端构建/类型检查与改动文件 lint 已通过。前端已发布 https://watermark-remover-ui.vercel.app（2026-10-15 由 watermark-remover-rose-chi.vercel.app 更换）。2026-10-15 用户确认 Go 后端云端部署与真实联调已完成，无问题；本阶段已收尾，原源码交付与 pending 配置阻塞不再列为当前待办。验收依据为用户确认，详见[实施记录](../logs/2026-10-13-go-api-migration.md)。

## React 前端迁移

`apps/web` 已完成 PASS 1、PASS 2 与 PASS 3，并完成向 beUI (beui.dev) 交互动效规范与黑白极简工作室设计（Monochrome Studio）的全面重构：
1. 彻底淘汰原有的紫色调（`hsl(243, 75%, 59%)` 及各类 purple/violet 散落类），全站贯彻**纯黑白极简单色调**与**严格零阴影 (Zero-Shadow)**；
2. 基础组件全面替换为 beUI 原生组件：`RangeSlider` / `InlineSlider`（一体化内嵌 Label 与读数、物理弹簧与过字裂开避让手柄、点状刻度）、`FileUpload`（beUI 原装居中上传组件，消除 hover 浮点缩放导致的亚像素边框模糊/裁切）、`Card`（组合式 parts 与 interactive 缩放）、`Loader`（17 种高拟真动画变体）、`Input`（错误抖动与状态反馈）、`MotionButton` / `StatefulButton`（字符流动动画）、`Alert`（Animated Alert 弹性进退场）、`AnimatedBadge`（状态图标轮转、文字翻滚与微呼吸）、`ReasoningText`（AI 执行状态分步 Shimmer 与字符过渡）；
3. 2026-10-15 起全站移除顶栏（含 logo 与站名）；头像与退出登录菜单、主题控制（系统、浅色、深色）均在底部 `AppDock` 内；
4. 前端类型检查、生产构建及 ESLint 校验全部 0 错误通过，详见[beUI 重构记录](../logs/2026-10-13-beui-monochrome-redesign.md)及[UI 细节调优与处理状态重构记录](../logs/2026-10-14-ui-polish-and-processing-overlay-redesign.md)；
5. 彻底解决“全图消除”与“涂抹消除”两模式同图不同尺寸的渲染撕裂：废除双 DOM 容器，改为由统一的 `MaskEditor` 单 Canvas 底座承载两种模式，确保 100% 像素级同一尺寸；同时将原本局促的画笔滑块从 `w-36` 拓展至大方舒展的 `w-72`（288px）；
6. 新增小红书无水印解析与图集下载前端页面（`XHSApp`），并通过底部应用导航实现小红书解析与图片去水印工作台无缝切换；导航现已按用户选定的 Paul Wong 参考站替换为 `AppDock`，复刻 301→420px 胶囊展开、61px 高度、主题按钮与八层渐进模糊，保留原有应用状态，支持单图受控流式下载与 ZIP 打包下载。2026-10-15 按用户要求移除结果卡片“去水印”导入入口，未出结果时解析区居中，解析输入、粘贴/清空、解析及下载操作统一采用官方 beUI `Input`、`Button` 和 `StatefulButton`，移除业务层手写 loading 及控件尺寸覆盖；图片预览已替换为 beUI 官方 `ImageViewer`，支持缩放拖动、图集切换、Esc 关闭和焦点恢复，类型检查、构建、改动文件 lint 及本地模拟图集交互验证通过。历史实现见[小红书前端与 Dock 实施记录](../logs/2026-10-14-xhs-frontend-dock-implementation.md)，Dock 外观与验证见[参考站 Dock 还原记录](../logs/2026-10-14-paul-wong-dock.md)。Go 后端真实联调已完成，验收状态见上文「Go 迁移与分离部署」。

2026-10-15 按用户要求对全站 UI 整体重排，解决“组件叠加”：圆角收敛为控件 `rounded-full`、表面 `rounded-2xl` 两档；业务页统一使用 `motion/button/base`；小红书输入、粘贴/清空和解析合并为一条胶囊；去水印工作台移除步骤条、工具栏外层胶囊与处理态 HUD 卡片，结果页对比切换与下载并入同一行；错误统一用顶部悬浮提示。`AppDock` 外观与交互保持原样，仅追加头像。涂抹画笔工具移到画布下方（四档预设、图标撤销/清空），画布上不再覆盖控件。规范见 [DESIGN.md](../../DESIGN.md) §1.3、§5，类型检查、构建与改动文件 lint 通过；上传、编辑页与 Dock 已在浏览器模拟登录下目视验收，处理中与结果页待真实后端验收，详见[重排记录](../logs/2026-10-15-ui-restructure.md)。

## 抖音后端

2026-10-15 首版 DouK 5.8 普通图集后端已补齐为小红书/抖音同等图片及视频能力：HTTP 与 MCP 均支持解析、单图、图集 ZIP、MP4 原文件下载；网页统一为“链接解析”，自动识别两平台。两边共用视频下载与 MCP 文件交付实现。实况仍不支持。本地针对性 race 测试、前端构建及 lint 通过；未部署生产，真实平台验收按用户要求留给用户。当前实施见[图片/视频对齐记录](../logs/2026-10-15-media-parity.md)，首版历史见[记录](../logs/2026-10-15-douyin-backend.md)。

## 下一步

### Grok Bot 接入

MCP 使用官方 Go SDK、独立 Bearer 凭据，已通过 tccli/TAT 部署至 `https://43.138.214.93/api/mcp`。探针基线已提交 `1b5185c`；正式业务版本已实现、部署并通过客户端验收，提供七个工具，复用网页业务服务与处理槽位。针对性 race 测试、vet、Linux 构建及公网免费检查通过。

客户端已验证：认证、ImageContent 与聊天附件原字节回传；同步长调用约 60 秒超时，因此业务改为异步任务。新的 120 秒异步测试通过原生 get_task 分段查询，无超时；ZIP 经原生内嵌 resource 交付并在本机验证字节、摘要及完整性。image-workbench Skill 已保存到 Grok Bot 私有技能库并读回一致。

真实 Lite/Flash 全图及 Lite 区域三次调用已成功，三图交付 ZIP 在本机独立校验通过；小红书解析、单图和 ZIP 原文件交付已通过原生调用与短期链接验收。修复了宿主图片重编码/缺失文本元数据的交付问题，以及 Gradio 放大文件 URL 错误前缀。诊断工具已关闭，公网只保留七个正式工具。正式连接器现为 `image-workbench`，完整七工具目录已发现，旧探针注册已移除，私有 Skill 已读回。修复后的“小红书首图 → sourceJobId 放大两倍 → 原文件附件”链路通过，WebP 字节、摘要及两倍尺寸已独立核对。本轮接入已完成，日常可直接向 Grok Bot 提供图片或公开笔记分享内容；任务重启失效等个人单实例边界见说明。操作见 [MCP 说明](../../apps/server/MCP.md)，当前实施与证据见[业务接入记录](../logs/2026-10-15-mcp-business.md)，历史兼容性见[探针记录](../logs/2026-10-15-mcp-probe.md)。

### 拟真照片打印机

用户已确认白色实体打印机方向并要求拆分后推进下一项。T1 独立单片样机已实现：透明机身资产 + Three.js 相纸，支持按压、启动、出纸、取片预览、重播与下载；本地桌面/手机检查和构建通过。当前没有完整 GLB 机身，也未接真实解析。后续为 T2 完整 3D 机器、T3 真实解析与图集、T4 产品接入验收，详见[任务清单](../photo-printer-plan.md)。

## 小红书下载验证

独立 HTTP 探针已实现；第一轮 5 条真实长链接均跳转登录页。追加匿名浏览器对照后，已取得其中两条笔记的完整图集并下载 9 张候选 JPEG（另有 9 张预览），全部完整解码，该轮视觉检查未发现平台附加的可见水印。本机浏览器解析与媒体下载链路具备可行性；后续云端验证见下文，单图、短链仍未验收，未新增产品功能。历史证据见[浏览器对照记录](../logs/2026-10-11-xhs-browser-validation.md)。

用户进一步要求核对登录前后画质与风控；[同图对照](../logs/2026-10-11-xhs-login-comparison.md)已确认两笔记 9 张候选图片的资源地址及下载文件逐字节一致，登录没有提高这批样本在本项目下载方式下的画质。两种访问均不能保证不受限制，风险证据见[调研记录](../logs/2026-10-11-xhs-resolution-risk-research.md)。

追加[社区解析路线调研](../logs/2026-10-11-xhs-parser-options.md)后，不直接将 Playwright 定为云端方案。[XHS-Downloader 接入评估](../logs/2026-10-11-xhs-downloader-integration-review.md)确认现有 API 适合单笔记解析。2026-10-13 机主回传：XHS-Downloader 2.8 独立容器已在腾讯云部署并通过启动验收，仅绑定 `127.0.0.1:5556`，三处 TLS 补丁命中，512 MiB/1 CPU 限制生效。追加三条真实图文长链接验证：匿名解析均成功，10/10 张候选 JPEG 下载且完整解码，解析耗时 4.4–6.9 秒，内存约 89→92 MiB，无 OOM、重启 0 次。附带联系图中未发现明显平台附加可见水印，该视觉判断限于缩略图，不能保证作者原文件或隐藏水印。部署过程及证据边界见[部署记录](../logs/2026-10-13-xhs-deployment-review.md)。云端 Python 候选链路已通过这批样本验证；Go 响应适配及下载后端已实现并通过本地测试，云端部署与真实联调的收尾状态见上文「Go 迁移与分离部署」。用户本次确认未附逐项样本和并发、长期稳定性数据，不新增这些专项验证结论；未引入账号 Cookie 或浏览器依赖。
