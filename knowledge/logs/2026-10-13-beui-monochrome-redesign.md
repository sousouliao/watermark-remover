# 开发日志：beUI 交互动效与黑白极简工作台重构

日期：2026-10-13

## 目标

1. 按照用户要求，接入 [beUI](https://beui.dev/) 动效交互组件规范与体系。
2. 彻底移除旧有紫色主色调（包括 `hsl(243, 75%, 59%)` 及各种散落的 violet/purple 类），重构为专业级纯黑白色调（Monochrome Studio / Obsidian & Chalk）。
3. 全面升级核心视觉与交互流转：
   - 步进指示器（Steps Stepper）黑白高对比化；
   - 模型选择（Lite / Flash）与模式选择（全图直接消除 / 涂抹指定区域）采用 beUI 核心 Spring Tabs（Pill / Segment 带动态 clip-path 反色与平滑滑块）；
   - 动作操作栏采用 beUI 浮动岛设计，接入 `MotionButton` 与 `StatefulButton`（微弹簧回弹、处理中文字流动动画）；
   - 上传区升级为黑白点阵、微物理拖拽弹簧缩放；
   - 画布蒙版工具栏重构为 Studio 工具台，使用双环高对比度光标；
   - 结果展示区支持滑动对比与并排对比的 Spring Tabs 切换，纯黑白对比手柄与标签；
   - 主题切换器（ThemeToggle）升级为物理 spring 触感黑白切换。

## 改动内容

1. **依赖引入与动画体系**：
   - 安装并验证 `motion`（React 19 兼容版本）；
   - 引入 beUI 的动画曲线及弹簧物理 tokens [`apps/web/src/lib/ease.ts`](../../apps/web/src/lib/ease.ts)；
   - 引入硬件级 Hover 判定 [`apps/web/src/lib/hooks/use-hover-capable.ts`](../../apps/web/src/lib/hooks/use-hover-capable.ts)，解决移动端轻触残存 Hover 态的问题。
2. **beUI 核心组件实现**：
   - [`apps/web/src/components/motion/tabs.tsx`](../../apps/web/src/components/motion/tabs.tsx)：实现带物理弹簧和实时 clip-path 遮罩文本反色的 Tabs（Pill、Segment 变体）；
   - [`apps/web/src/components/motion/button.tsx`](../../apps/web/src/components/motion/button.tsx)：实现具备 Spring Press（`scale: 0.96`）微回弹的 `MotionButton` 与支持文本字符流动替换动画的 `StatefulButton`。
3. **样式与色彩系统全面革新**：
   - [`apps/web/src/style.css`](../../apps/web/src/style.css)：重写 CSS HSL 变量，浅色模式为纯白/纯净灰/纯黑对比，深色模式为黑曜石底/钛灰卡片/高对比度白字；删除旧渐变紫色，建立 `.bg-dot-grid`、纯黑白 `.gradient-btn` 及专业磨砂玻璃卡片。
4. **业务组件重塑**：
   - [`AppHeader.tsx`](../../apps/web/src/components/AppHeader/AppHeader.tsx)：重构为极简工作台标头；
   - [`ThemeToggle.tsx`](../../apps/web/src/components/ThemeToggle/ThemeToggle.tsx)：引入微弹簧按压缩放交互；
   - [`ImageUploader.tsx`](../../apps/web/src/components/ImageUploader/ImageUploader.tsx)：点阵背景 + 物理拖拽回弹；
   - [`ActionBar.tsx`](../../apps/web/src/components/ActionBar/ActionBar.tsx)：悬浮 Dock + StatefulButton 文本流处理动画；
   - [`ProcessingOverlay.tsx`](../../apps/web/src/components/ProcessingOverlay/ProcessingOverlay.tsx)：极简雷达与流动指示器，无彩色干扰；
   - [`MaskEditor.tsx`](../../apps/web/src/components/MaskEditor/MaskEditor.tsx)：黑白双环全天候可见光标，专业暗室工作台布局；
   - [`ResultViewer.tsx`](../../apps/web/src/components/ResultViewer/ResultViewer.tsx)：采用 beUI Tabs 切换滑动/并排对比，黑白对比胶囊标签；
   - [`WatermarkApp.tsx`](../../apps/web/src/pages/WatermarkApp.tsx)：主调度中枢整合所有新组件，步骤指示器与模型选择器焕然一新。

## 验证结果

1. **类型检查**：`pnpm -F @watermark-remover/web type-check` 0 错误通过。
2. **生产构建**：`pnpm -F @watermark-remover/web build` 快速打包成功，PWA Service Worker 正确生成。
3. **代码规范**：`pnpm eslint apps/web/src --fix` 0 警告 0 报错通过。

## 5. beUI 组件全面替换审计与接入（第二阶段）

用户明确提出“尽可能使用 beUI 的组件，检查现在哪些组件是自己写的且可以替换的，进行替换”；经排查并从 beUI Registry（beui.dev/r）抓取原生实现，完成了以下替换升级：
1. **RangeSlider**（[`apps/web/src/components/motion/range-slider.tsx`](../../apps/web/src/components/motion/range-slider.tsx)）：
   - 接入 beUI 原生带手势捕获（`lib/touch.ts`）、`useSlider` 物理弹簧计算的滑动器，替换了原旧 Radix 原生 Slider，并无缝适配 MaskEditor 中的画笔粗细调节；
2. **Card**（[`apps/web/src/components/motion/card.tsx`](../../apps/web/src/components/motion/card.tsx)）：
   - 引入 beUI 原生组合式 Card 规范（CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction），支持 interactive 微交互与物理缩放，零阴影；
   - 升级 [`apps/web/src/components/ui/card/`](../../apps/web/src/components/ui/card/) 对其全面 re-export；
3. **Loader**（[`apps/web/src/components/motion/loader.tsx`](../../apps/web/src/components/motion/loader.tsx)）：
   - 抓取并接入 beUI 17 种高拟真变体（dot-matrix, morph, spinner, bars, comet 等），用于替换 ProcessingOverlay 及 ResultViewer 中的简陋旋转图标；
4. **Input**（[`apps/web/src/components/motion/input.tsx`](../../apps/web/src/components/motion/input.tsx)）：
   - 引入 beUI 原生带抖动错误反馈（error shake）、成功标记动画的 Input 组件，升级 [`apps/web/src/components/ui/input/`](../../apps/web/src/components/ui/input/)；
5. **Button**（[`apps/web/src/components/ui/button/Button.tsx`](../../apps/web/src/components/ui/button/Button.tsx)）：
   - 全面接轨 beUI `MotionButton` 与 `StatefulButton`，统一全站触感与 Spring Press 逻辑；
6. **Alert**（[`apps/web/src/components/motion/alert.tsx`](../../apps/web/src/components/motion/alert.tsx) 与 [`apps/web/src/lib/presence-gate.tsx`](../../apps/web/src/lib/presence-gate.tsx)）：
   - 抓取 beUI Animated Alert，替换主工作区及结果查看区的静态错误横幅；
7. **ActionSwapIcon 与 ThemeToggle**：
   - 引入 beUI `ActionSwapIcon` 动效（blur / roll），实现极具质感的深浅模式原地流转；
8. **AppHeader 菜单**：
   - 用户头像+登录名胶囊增加 `whileTap` 触感，弹出下拉菜单支持 Spring 展开与收起，严格保证零阴影、单屏自适应。
