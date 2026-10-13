# 2026-10-14 UI 细节调优与处理状态界面重构记录

## 背景

在用户审视前端界面的过程中，提出了多项关键体验与视觉对齐问题：
1. `RangeSlider` 相比 beUI 官网缩水、擅自覆盖内边距破坏比例的问题；
2. 顶栏右侧 `ThemeToggle` 与 `UserMenu` 高度不一致（已统一为 32px）；
3. 工具条圆角与内边距不对称（已统一为 `rounded-full` 与四边等距 `p-1.5`）；
4. 图片展示区未左右或上下贴边包裹（已移除硬编码限制与外边距）；
5. 上传组件 `ImageUploader` 在 Hover 时左右虚线边框出现亚像素模糊与被裁切问题；
6. 顶栏用户菜单中下拉弹出菜单宽度与名牌胶囊宽度不一致、左侧凸出的问题；
7. 图片处理等待界面（`ProcessingOverlay`）视觉空洞、文字全透明隐形只剩 ASCII 竖线字符 `|`、生硬黑粗进度条与脱节悬挂取消按钮的问题。

## 关键改动

### 1. `ImageUploader` 接入 beUI 原生 `FileUpload`
- **问题分析**：手写组件添加了 `whileHover={{ scale: 1.008 }}`，在宽 576px 的容器上放大到 580.6px。非整数像素缩放导致 GPU 亚像素重采样（Subpixel Anti-aliasing），使 1px 虚线边框对比度大幅下降被平分稀释，加之 `overflow-hidden` 硬裁切产生边缘缺失假象。
- **改动**：
  - 从 beUI Registry 接入原装 `FileUpload`（`components/motion/file-upload.tsx`）；
  - `ImageUploader` 直接使用 `variant="centered"`，悬停纯色边框过渡（`hover:border-foreground/40`），杜绝大容器 hover 浮点缩放；
  - 写入 `DESIGN.md`《3.7 文件与图片上传：FileUpload》。

### 2. `UserMenu` 宽度像素级 1:1 对齐
- **问题分析**：下拉面板写死 `w-44`（176px）且为 `right-0`，而名牌按钮自适应宽度仅约 140px~150px，导致左侧突兀悬空。
- **改动**：
  - 名牌胶囊设置 `min-w-36 max-w-48`（144px ~ 192px）保底与防溢出；
  - 下拉卡片改为 `left-0 right-0`，由包含块宽度绝对拉伸，宽度 100% 严格一致，左右边线像素级垂直对齐；
  - 展开时名牌联动高亮（`border-foreground/40 bg-muted/70`）。

### 3. 处理中界面 `ProcessingOverlay` 深度重构
- **Bug 根治**：`text-shimmer.ts` 中渐变背景色直接写 `var(--muted-foreground)`，在 Tailwind HSL 通道体系下导致 `linear-gradient` 语法失效，只剩 `text-transparent` 单独生效使得所有步骤文字完全隐形。已修复为 `hsl(var(--muted-foreground))` 与 `hsl(var(--foreground))`，恢复微光掠过效果。
- **原位暗室扫描工作台**：
  - 处理期间待处理原图不退场，在中央工作区呈现暗室柔焦遮罩（`backdrop-blur-[3px] bg-background/50`）；
  - 贯穿纯黑白高光水平扫描激光线（Neural Laser Scanning Wave），提供“AI 正在像素级分析消除水印”的真实物理感知。
- **一体化 Neural Processing HUD 浮岛**：
  - 顶部：beUI 原生 `AnimatedBadge` 展示模型标签，右侧毫秒级实时耗时秒表（`0.8s`）；
  - 中央：beUI 原生 `Loader variant="dot-matrix"` 点阵粒子波纹，搭配修复后的微光流动 `ReasoningText`；
  - 进度：4px 发丝轨道流动高光流波；
  - 操作：取消处理按钮以 Ghost 样式内嵌于控制台底部，彻底消灭下方脱节悬挂的按钮。

### 4. 彻底根除 CLS 布局偏移与页面重绘抖动
- **MaskEditor 工具栏悬浮化**：将原本插在图片上方的 68px Card 工具栏重构为画板内部底端的悬浮毛玻璃胶囊（`absolute bottom-3 left-1/2 -translate-x-1/2 z-20`），切换全图与涂抹模式时画布上/下边缘 1 像素都不发生位移。
- **全局错误提示 Toast 化**：将原本硬插在文档流中央的 Alert 抽取为视口顶部浮动通知（`fixed top-14 left-1/2 -translate-x-1/2 z-50`），错误出现或关闭时彻底消除下推 70px 的大跳荡。
- **Studio 控制台槽位恒定**：模型/模式控制架高度恒定为 44px，处理中不销毁仅通过 `opacity-50 pointer-events-none` 锁定，结果页右侧平滑流转为微调/重生成动作，保证主舞台四角绝对物理重合。
- **写入规范**：将空间物理恒定铁律作为第 5 章正式写入 `DESIGN.md`。

### 5. 单画布双模式统一与画笔滑块舒展尺度重构
- **全图消除与涂抹消除图片大小不一根治**：
  - **问题分析**：全图模式原使用独立的 `<img>` 标签，依赖 CSS 纯类名约束（`max-h-[min(54vh,calc(100svh-270px))]`）；涂抹模式则使用 `MaskEditor` 组件，其内部 canvas 尺寸是由 `useMaskEditor.ts` 结合视口高度与硬编码上限经 JS 动态缩放计算所得。两套互不相同的包裹容器、padding、flex 伸缩与高度截断规则，导致同张图片在切换“全图消除”与“涂抹消除”时出现明显的忽大忽小与重绘跳动。
  - **解法**：废除双 DOM 容器机制。`MaskEditor` 增加 `mode?: 'direct' | 'region'` 属性。在全图消除模式下直接复用 `MaskEditor` 的统一 Canvas 画布底座，仅通过 `pointer-events-none` 禁用蒙版绘制并隐藏画笔悬浮 HUD；在涂抹消除模式下平滑激活蒙版与底部 HUD。两模式彻底共用**同一套 DOM 容器与尺寸引擎**，确保 100% 像素级无缝一致。
- **画笔滑块太短局促问题修复**：
  - **问题分析**：画笔调节滑块原本在 `InlineSlider` 上写死了 `w-32 sm:w-36`（仅 128px~144px），“画笔”文字与数值读数挤占两侧后，中间实际滑动行程仅剩几十像素，极难精准拖拽且显得局促小气。
  - **解法**：将 InlineSlider 宽度由 `w-32 sm:w-36` 大幅拓宽至 `w-44 sm:w-60 md:w-72`（最大 288px），恢复“画笔大小”完整描述文字，滑块底盘从容舒展，大幅提升大范围与精细化画笔半径调节的操作精度。

### 6. 画笔 HUD 按钮挤压变形、文字竖排断行与包含块逃逸重叠根治
- **问题分析**：
  1. **双重透明度叠加（为什么那么淡）**：业务层在未涂抹时手写了 `text-muted-foreground/40` 与剥除背景边框，而组件基类又自带 `disabled:opacity-40`，导致透明度发生双重复合缩放（$0.4 \times 0.4 = 0.16$ 甚至更低），在浅色背景上文字几乎完全隐形消失，根本不是原版正常的 disabled 表现；
  2. **包含块逃逸与 Dock 撞车**：此前尝试将 HUD 移出 Canvas 时，外层容器遗漏了 `position: relative`，导致 `absolute bottom-3.5 left-1/2` 向上穿透寻址直至根视口，直接掉到了浏览器视口最底端，与视口底部的悬浮 `Dock` 导航栏发生 100% 垂直叠罗汉重叠；
  3. **缺少防挤压保护导致字符折行**：此前 `MotionButton` 与动作按钮未设置 `whitespace-nowrap` 与 `shrink-0`，当滑块占据空间后，所有溢出压缩压力全转嫁至右侧按钮，导致中文字符在“撤”与“销”、“清”与“空”之间被硬生生挤成竖排两行字。
- **改动**：
  1. **彻底回归原生 disabled 规则**：移除业务层所有手动覆盖的 `text-muted-foreground/40` 和透明剥离；使用标准原装 `variant="secondary"`，让 `disabled` 属性自然触发全局标准的 `disabled:opacity-50`。Disabled 状态下胶囊轮廓与文字、图标清晰可辨、对比度完全正常舒适，绝无隐形鬼影；
  2. **严格锚定在画布内部底端**：将 HUD 放回具有 `relative overflow-hidden` 的 Canvas 根容器内部底端（`bottom-3.5 left-1/2 -translate-x-1/2`）。包含块锁死在图片画布本身，100% 杜绝逃逸到视口底部去与全局 Dock 碰撞，同时绝不遮挡画布下方的 `ActionBar`（换一张/消除水印）；
  3. **全局防御**：在 `MotionButton` 基类中强制加入 `whitespace-nowrap shrink-0` 与标准 `disabled:opacity-50`，杜绝任何 Flex 容器中的文字折行断裂；
  4. **滑块弹性适配**：滑块采用 `w-32 sm:w-44 md:w-56 shrink min-w-20` 弹性伸缩，操作区整体设置 `shrink-0`。

## 验证结论

- `pnpm -F @watermark-remover/web type-check`：0 错误
- `pnpm eslint apps/web/src`：0 错误 0 警告
- `pnpm -F @watermark-remover/web build`：构建成功（~305ms）
- 界面视觉与交互经核对验收：全图与涂抹模式下图片尺寸 100% 绝对一致；画笔 HUD 严格居中悬浮在待处理图像底端，与视口底部的 Dock 和画布下方的 ActionBar 层次绝对清晰、互不重叠；“撤销”与“清空”微胶囊按钮 100% 保持水平单行排列，Disabled 状态对比度正常、清晰可读，无折行、无挤压、无隐形。

