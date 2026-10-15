# Watermark Remover 前端设计规范 (DESIGN.md)

全站以 **Monochrome Studio（黑白极简工作室）** 为基调，交互控件默认采用 **[beUI](https://beui.dev)** 原生动效体系，底部应用导航按 Paul Wong 参考站定制（§3.6）。

---

## 1. 核心设计原则

### 1.1 黑白极简与零阴影
- **只用黑、白、钛灰**：不出现主题彩色与彩色渐变光晕。
- **零阴影**：层级靠 `border-border` 线条、纯色块与留白构建，不用扩散投影与发光。`AppDock` 的参考站细阴影是唯一例外。
- **物理触感**：可交互元素使用 `motion` 弹簧曲线（`SPRING_PRESS`、`SPRING_SWAP`、`SPRING_GLIDE`），不用线性过渡。

### 1.2 beUI 原装优先
- Tabs、Button、Loader、Alert、FileUpload 等控件直接接入 [beUI Registry](https://beui.dev/registry.json) 的原生实现，交互细节与官方一致。
- beUI 已有对应组件的形态，业务层不用基础 HTML 手拼（如 div 拼错误框）。

### 1.3 层级与圆角
- **圆角两档**：控件（按钮、输入框、Tabs、图标按钮）`rounded-full`；表面（卡片、画布、图片、Alert、菜单）`rounded-2xl`。
- **一条控件一个容器**：相关控件放进同一条胶囊（如链接输入框内嵌粘贴/清空与解析）。
- **按钮只用 `motion/button/base`**：`Button` 与 `StatefulButton`。旧 `motion/button.tsx` 仅供 `components/ui/button` 兼容封装。
- **每页一个主操作**：用 `primary` 变体，次要操作用 `ghost` 或 `outline`。页面标题用 `PageHeading`，文字与 `AppDock` 对应应用名一致（图片去水印、链接解析）。

---

## 2. 铁律：业务层只通过 Props 调整组件

组件的内边距、外边距、高度与字号已经调优。尺寸只用组件原生 Props（`size="sm" | "md" | "lg"`、`variant="pill" | "segment"`），业务层 `className` 只负责布局与定位。

**教训**：给 `TabsList` 传 `p-0.5`、给 `TabsTrigger` 传 `px-2.5 py-1 text-xs`、给 `Button` 传 `h-7`，会让四字中文顶满滑块边缘，字显得巨大笨拙，各页比例也随之失真。

---

## 3. 组件规范

### 3.1 Tabs
- `variant="pill"`：浅灰无边框胶囊底槽（`p-1 gap-1 bg-muted rounded-full`），黑色滑块居中悬浮；Trigger 为 `px-3.5 py-1.5`，选中反色由 `clip-path` 遮罩完成。
- `variant="segment"`：无边框轻内嵌底座（`rounded-lg bg-muted p-1`）。

### 3.2 处理中状态
- 处理中界面用 `ReasoningText`（文字微光扫过、多阶段过渡）配 `Loader variant="dot-matrix"` 或 `morph`。

### 3.3 提示与错误
- 错误、警告统一用 `Alert`（含 `presence-gate` 进退场），呈现位置见 §5.2。

### 3.4 上传：`FileUpload`
- 直接用 `FileUpload variant="centered"`，图标、文字与交互与官方一致。
- 带 dashed 边框的大容器上不做 hover scale：亚像素重采样会让虚线被稀释或裁剪。
- 悬停只过渡边框高亮（`hover:border-foreground/40`）与浏览胶囊底色（`group-hover:bg-muted`）；拖入时图标上浮 2px；点击带 `active:scale-[0.99]` 按压。

### 3.5 并排对比预览
- 结果页并排视图用 `ImageViewer`：缩略图点击进入灯箱，灯箱需要图片真实尺寸，读到之前格子退回普通 `<img>`。格子尺寸由固定舞台决定（§5.5）。

### 3.6 悬浮应用导航：`AppDock`
- **参考**：[Paul Wong](https://www.paulwong.work/)，保留本项目功能，还原参考站外观与动效。位于 `apps/web/src/components/AppDock/`。
- **尺寸**：黑色实底胶囊，默认宽 301px、展开宽 420px、高 61px、圆角 39px，底部间距 39px 加 safe-area；内边距 13px 20px 13px 24px，分组间距 16px；窄屏宽度为视口减 32px。
- **应用切换**：图片去水印与链接解析（小红书/抖音共用）；悬停或键盘聚焦时用 Motion 布局弹簧展开名称与图标，3px 模糊淡入淡出；名称为系统字体 14px、500 字重；小屏展开时省略图标。
- **主题**：右侧跟随系统、浅色、深色三个 35px 按钮，沿用 `theme` 存储键，跟随系统时响应系统主题变化。
- **账户**：登录后在主题按钮右侧追加分隔线（小屏隐藏）与 35px 圆形头像，胶囊宽度在 301/420px 基础上加 64px，右内边距收为 13px。点击头像向上弹出黑底账户菜单（登录名、退出登录），右缘与胶囊对齐；点外部或 Esc 关闭，Esc 后焦点回到头像。
- **层次**：局部复刻参考站三层细阴影与深色细描边；239px 渐进模糊区由 8 层 masked backdrop blur 组成（0.1875px 递增至 24px），不接收指针事件。
- **空间**：正文底部预留 239px，保证滚动到底时主要操作位于模糊区上方；版权信息置于模糊层之上。

---

## 4. 实施自检清单

每次改前端 UI 或新增组件时逐项核对：
1. [ ] 控件已在 beui.dev 找到官方实现且交互一致（`AppDock` 按 §3.6 核对）。
2. [ ] 业务层没有用 `className` 覆盖组件内部 padding、height、font-size（§2）。
3. [ ] 保持黑白单色与零阴影（§1.1）。
4. [ ] 模式切换、状态变更、错误提示时，画布与操作按钮坐标不变（§5）。
5. [ ] `pnpm -F @watermark-remover/web type-check`、`build` 与 `pnpm eslint apps/web/src` 0 错误 0 警告。

---

## 5. 空间稳定性准则（Zero-CLS）

用户视线锚定在主舞台上，局部状态变化不得推挤文档流。

1. **画布上不覆盖控件**：涂抹消除的画笔工具位于画布**下方**操作行中间，左“换一张”、右“消除水印”，窄屏时画笔工具单独占第一行（水印常在图片底部，悬浮工具条会挡住要涂的地方）。画笔大小为四档圆点单选（12/24/40/60px，默认 24px），撤销与清空为带 `aria-label` 与 `title` 的图标按钮。图片上方不插入静态 Card 块。
2. **通知与错误不推挤文档流**：用 `FloatingAlert`（`fixed z-50`，距视口顶部 1rem 加 safe-area），出现与关闭时页面元素位置不动。
3. **顶部工具架槽位恒定**：模型选择与模式控制栏高度恒定（44px）；处理中用 `pointer-events-none opacity-50` 锁定，保持在 DOM 中，主舞台上边缘位置不变。
4. **控制栏防挤压**：按钮基类具备 `whitespace-nowrap shrink-0`，中文不被挤成竖排；空间不足的工具按钮改用图标按钮。全图/涂抹切换时只淡入淡出中间工具，左右两端按钮位置不变。
5. **结果视图共用固定舞台**：滑动与并排共用一个按原图比例、`max-h-[70vh]` 定高的舞台，两种视图都 `absolute inset-0` 填满，切换时下方操作行位置不变。
