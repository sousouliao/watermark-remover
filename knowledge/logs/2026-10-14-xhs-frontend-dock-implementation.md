# 2026-10-14 小红书前端解析与 beUI Dock 底部导航实施记录

## 目标

1. 接入并实现小红书链接解析与高清图集提取的前端界面（`XHSApp`），对齐已实现的 Go 后端 API（`/api/xhs/parse`、`/api/xhs/results/{id}/images/{index}` 与 `/api/xhs/results/{id}/archive`）；
2. 接入 beUI 官方原生 `Dock` 组件（来自 `beui.dev/r/dock.json`），固定在页面底部舒适位置，实现“图片去水印”与“小红书解析”双应用的无缝切换；
3. 严格遵循 `DESIGN.md` 中的 **Monochrome Studio（黑白极简工作室）** 与 **Zero-Shadow（严格零阴影）** 设计铁律，打通“小红书提取 -> 一键送入去水印画布”的无缝工作流闭环。

---

## 实施详情

### 1. beUI 原生 Dock 组件 1:1 官方一致性落地 (`apps/web/src/components/motion/dock.tsx`)
- 100% 逐字逐行对齐 [beUI 官方 Registry (dock.json)](https://beui.dev/r/dock.json) 与 [官方文档预览](https://beui.dev/components/motion/dock)；
- 容器结构严格保持官方标准：`rounded-2xl border border-border bg-card/80 px-2 py-1 shadow-2xl backdrop-blur-xl`；
- 选项单元严格保持官方标准：`size = 44`（44x44px）圆形大图标交互项，选中时依托 `SPRING_LAYOUT` 物理弹性驱动 `absolute inset-0.5 -z-10 rounded-xl bg-muted/60` 活跃药丸平滑滑移；
- 业务层零样式入侵：严禁在 `DockItem` 内部塞入文字或强行覆盖 padding，纯图标设计配合 `aria-label`；
- 彻底解决与页脚撞车重叠：悬浮 Dock 居中悬停在视口底部舒适位置（`fixed bottom-6 left-1/2 -translate-x-1/2 z-50`），页脚版权信息移至右下角静默显示，留给中央 Dock 纯净、独立的展示空间。

### 2. 小红书解析与下载界面极致做减法 (`apps/web/src/pages/XHSApp.tsx`)
- **文案减法**：彻底切除所有浮夸标签（如“✨ 高清无水印图集提取”）与说明书式长篇副标题，去除营销腔，文案回归纯粹克制（标题仅保留“小红书解析”，占位符仅保留“粘贴小红书链接或分享文本…”，操作仅为“解析”、“下载”、“去水印”与“下载全部 ZIP”）；
- **结构减法**：淘汰多重嵌套的卡片与笨重 Textarea，采用一体化集成胶囊输入条（内嵌粘贴/清空与 Enter 快捷解析）；
- **结果区减法**：去除臃肿的背景底板卡片，直接以一条极简细线呈现笔记核心摘要与 ZIP 下载，图集卡片采用轻盈微边框与小巧快捷操作栏；
- **鉴权安全流式下载** (`apps/web/src/lib/xhs.ts`)：
  - 针对后端受保护路由，通过 `apiFetch` 自动注入 Bearer Token 转换为 Blob 与临时 ObjectURL，彻底杜绝直接 `<a>` 标签跳转导致的 401 失败。

### 3. 工作流联动与状态保持 (`apps/web/src/pages/WatermarkApp.tsx`)
- 在工作台主容器中采用双视图并列与 `hidden` 属性控制显隐，用户在 Dock 来回切换时，双方的工作台状态（涂抹蒙版、解析图集）完全不丢失；
- 在小红书图集中点击任一图片的“送入去水印”，自动将图片转换为 DataURL 并调用 `app.loadImage(dataUrl)`，同时 Dock 自动滑向“图片去水印”标签，实现从图集采集到 AI 水印消除的一键闭环。

### 4. 全局图标净化（彻底剔除泛滥的 Sparkles 闪烁星图标）
- **小红书解析入口 (Dock)**：由泛滥的 `Sparkles` 替换为优雅对称的书卷笔记图标 `BookOpen`，与去水印的 `Eraser` 形成高度和谐的工作室“笔记/消除”文具工具对；
- **消除水印执行按钮 (ActionBar)**：由 `Sparkles` 替换为精准对应的 `Eraser`，语义 100% 契合消除动作；
- **超清放大按钮 (ResultViewer)**：由 `Sparkles` 替换为专业图形工具通用的 `ZoomIn`（超分辨率放大），全项目 `Sparkles` 图标使用量彻底清零。

---

## 验证结论

- 类型检查：`pnpm -F @watermark-remover/web type-check` 0 错误通过；
- 代码质量：`pnpm eslint apps/web/src` 0 错误 0 警告通过；
- 生产构建：`pnpm -F @watermark-remover/web build` 成功完成（272ms，产物完整生成）。
