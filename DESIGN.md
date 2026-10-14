# Watermark Remover 前端设计规范 (DESIGN.md)

本规范确立项目前端的视觉风格、交互动效准则、组件使用约束及防劣退机制。全站设计以 **Monochrome Studio（黑白极简工作室）** 为核心基调，默认采用 **[beUI (beui.dev)](https://beui.dev)** 原生动效体系。底部应用导航按用户选定的 Paul Wong 参考站定制，见 §3.8。

---

## 1. 核心设计原则

### 1.1 黑白极简工作室（Monochrome Studio）
- **色彩纪律**：全站坚决淘汰任何散落的主题彩色（包括各类紫色、蓝绿色等）与彩色渐变光晕；严格贯彻纯黑（Obsidian）、纯白（Chalk）、柔和钛灰阶调。
- **严格零阴影（Zero-Shadow）**：禁止大面积扩散投影、发光投影与伪立体阴影，使用清晰利落的黑白线条（`border-border`）、纯色块与自然留白构建层级。
- **物理触感（Physical Haptics）**：所有可交互元素必须具备真实的物理弹性反馈（`motion` 弹簧曲线 `SPRING_PRESS`、`SPRING_SWAP`、`SPRING_GLIDE`），避免生硬的线性过渡。

### 1.2 beUI 1:1 官方一致性
- **官方原装优先**：所有交互控件（Tabs、Slider、Button、Card、Loader、Alert、Badge、ThemeToggle 等）必须直接接入并 100% 对齐 [beUI 官方 Registry](https://beui.dev/registry.json) 原生规范。
- **拒绝粗劣自制**：严禁在业务层用基础 HTML 元素手工拼凑已经有 beUI 官方组件支持的交互形态（如用 div 拼错误框、用加减号拼滑块等）。

---

## 2. 铁律：严禁业务层擅自覆盖组件默认样式

> [!CAUTION]
> **严禁在页面或业务容器层通过 `className` 强行覆盖官方组件经过精密调优的内边距、外边距、高度与字号！**

### 2.1 违规做法与深刻教训
- **典型违规**：在 `TabsList` 上传 `p-0.5`，在 `TabsTrigger` 上传 `px-2.5 py-1 text-xs`，在 `Button` 上传 `h-7 text-xs`。
- **后果剖析**：
  1. **窒息感与字体巨化**：beUI 原生组件外层四周留白（`p-1` 4px）与选项内边距（`px-3.5 py-1.5`）是维持轻盈松弛感的核心。一旦擅自压减内边距，四字中文就会死死顶满整个滑块边缘，视觉上形成巨大的黑色压迫感，导致**字显得极大、极粗、极其笨拙**。
  2. **系统一致性崩塌**：随手手写高度和圆角会导致各页面组件比例失真，彻底丧失官方组件的统一美感。

### 2.2 正确调用原则
- **属性控制（Props Only）**：尺寸控制**只能**使用组件原生支持的 Props（例如 `size="sm" | "md" | "lg"`，`variant="pill" | "segment"`），严禁外部硬编码覆盖宽高与内边距。
- **呼吸空间优先**：保证组件周围拥有充分的内嵌留白，宁可留足 4px 内边距与清晰字距，绝不为了“微型化”破坏黄金比例。

---

## 3. 核心组件落地规范

### 3.1 滑块系列：`InlineSlider` 与 `RangeSlider`
- **来源**：`beui.dev/r/range-slider-inline.json`、`beui.dev/r/range-slider.json`
- **规范**：
  - **`InlineSlider`（一体化内联滑块）**：用于画笔大小调节等精密控制。
    - 自包含内嵌：左侧内嵌属性标签（如 `画笔大小`），右侧内嵌实时读数（如 `24px`）；
    - 智能避让：黑色垂直手柄滑动经过文字时，手柄**上下裂开避让文字**，保证文字永不被遮挡；
    - 刻度贯穿：等距刻度微点（ticks）贯穿整条轨道，重合文字处自动隐藏；
    - 严禁：外部拼接 `-`、`+` 加减按钮或外挂数字文本。
  - **`RangeSlider`**：标准轨道高度为 `h-10`（40px），圆角 `rounded-lg bg-muted`，默认开启等距刻度微点，手柄具备 `SPRING_BOUNCY` 弹性拉伸。

### 3.2 标签与分段切换器：`Tabs`
- **来源**：`beui.dev/r/tabs.json`
- **规范**：
  - **`variant="pill"`（胶囊药丸变体）**：底槽为纯净浅灰无边框胶囊（`flex items-center gap-1 p-1 bg-muted rounded-full`），黑色选中滑块悬浮居中，四周拥有 4px 均匀包裹感；
  - **`variant="segment"`（分段内嵌变体）**：无边框轻内嵌底座（`rounded-lg bg-muted p-1`）；
  - **选项 Trigger**：默认采用 `px-3.5 py-1.5` 与精致字重，底层依托 `clip-path` 遮罩实现瞬时高对比度反色。

### 3.3 主题切换：`ThemeToggle`
- **来源**：`beui.dev/r/theme-toggle.json`
- **规范**：
  - 接入原版 View Transition API 全屏柔光径向扩散动效（`variant="circle-blur"`，`start="top-right"`）；
  - 图标采用 `ActionSwapIcon` 原地模糊流转（`animation="blur"`），禁止使用突兀的瞬间翻转。

### 3.4 动态状态胶囊：`AnimatedBadge`
- **来源**：`beui.dev/r/animated-badge.json`
- **规范**：
  - 结果比对区等标识必须使用 `AnimatedBadge`；
  - 原生支持状态图标滚动翻转（`ICON_ROLL_VARIANTS`）、文字垂直滚动进出（`TEXT_ROLL_VARIANTS`）与呼吸微光（`pulse`），严禁使用纯静态 `<span>` 贴纸。

### 3.5 AI 执行状态：`ReasoningText` 与 `Loader`
- **来源**：`beui.dev/r/reasoning-text.json`、`beui.dev/r/loader.json`
- **规范**：
  - 图像处理中界面采用 `ReasoningText`（文字微光扫过 Text Shimmer 与多阶段字符过渡）；
  - 配合 beUI 原生 `Loader variant="dot-matrix"` 或 `morph`，展现具有未来感的工作室处理体验。

### 3.6 弹性反馈提示：`Alert`
- **来源**：`beui.dev/r/alert.json`
- **规范**：
  - 全站所有业务错误、上传失败提示统一采用 beUI 原生 `Alert`（包含弹性进退场动效 `presence-gate`）；
  - 严禁在登录页、上传区硬编码静态 `<div role="alert">` 或 `<p>` 标签。

### 3.7 文件与图片上传：`FileUpload`
- **来源**：`beui.dev/r/file-upload.json`
- **规范**：
  - 上传组件必须直接接入 beUI 原生 `FileUpload`（`variant="centered"`），100% 对齐官方图标结构、文字排版与交互逻辑；
  - **严禁大卡片 hover scale 缩放**：禁止在带有 1px 虚线边框（dashed）的大尺寸容器上施加任何 hover 浮点缩放（如 `scale: 1.008`），否则会导致 GPU 合成图层进行亚像素重采样，产生左右虚线边框被平分稀释、褪色或被裁剪的劣退；
  - 官方标准交互：悬停时仅过渡边框高亮（`hover:border-foreground/40`）与浏览胶囊底色（`group-hover:bg-muted`），拖入时图标小幅微浮（`translateY(-2px)`），点击时带微按压反馈（`active:scale-[0.99]`）。


### 3.8 悬浮应用导航：`AppDock`
- **视觉参考**：[Paul Wong](https://www.paulwong.work/)，用户确认保留本项目功能、还原参考站底部栏外观与动效。
- **实现**：`apps/web/src/components/AppDock/`；这是 beUI 原生一致性与零阴影原则的局部例外，不改变其他组件规范。
- **桌面尺寸**：黑色实底胶囊，默认宽 301px、展开宽 420px、高 61px、圆角 39px，底部间距 39px 加 safe-area；内边距 13px 20px 13px 24px，分组间距 16px。
- **交互**：左侧保留图片去水印与小红书解析；悬停/键盘聚焦展开应用名称与图标，使用现有 Motion 布局弹簧及 3px 模糊淡入淡出。中文名称采用系统字体 14px、500 中等字重；小屏展开时省略应用图标以保留完整名称。
- **主题**：右侧提供跟随系统、浅色、深色三个 35px 按钮，取代顶栏主题按钮；沿用 `theme` 存储键，跟随系统时响应系统主题变化。
- **层次**：局部复刻参考站三层细阴影与深色细描边；独立的 239px 渐进模糊区由 8 层 masked backdrop blur 组成，强度从 0.1875px 递增至 24px，不接收指针事件。
- **空间**：正文底部预留 239px，保证滚动到底时主要操作处于模糊区上方；版权信息置于模糊层之上；窄屏胶囊宽度限制为视口减 32px。

---

## 4. 实施自检清单（PR / 改动必备）

每次进行前端 UI 修改或增加新组件时，必须逐项核对：
1. [ ] **官网原型核对**：是否已在 [beui.dev](https://beui.dev) 找到官方原生组件，并确认交互细节一致？
   - 底部 `AppDock` 按 §3.8 的用户选定参考实现核对，豁免 beUI 原装要求。
2. [ ] **零样式侵入**：是否有在业务层通过 `className` 强行覆盖组件内部 padding、height 或 font-size？（如有，必须坚决移除）
3. [ ] **零杂色与零阴影**：是否全站保持纯黑白极简单色调？是否有非必要的彩色类名或 box-shadow？`AppDock` 的参考站细阴影为明确例外。
4. [ ] **零布局偏移（Zero CLS）**：在模式切换、状态变更、错误提示时，下方主画布与操作按钮是否保持 100% 物理坐标恒定？（严禁在画布上方硬插文档流块导致图片下坠）
5. [ ] **质量校验**：`pnpm -F @watermark-remover/web type-check`、`pnpm -F @watermark-remover/web build` 与 `pnpm eslint apps/web/src` 是否全部 0 错误 0 警告通过？

---

## 5. 空间稳定性准则（Zero-CLS Studio Architecture）

> [!IMPORTANT]
> 专业级图像工具的最高原则之一是**空间物理恒定（Spatial Stability）**。用户的视线焦点必须稳定锚定在主舞台上，严禁任何因局部状态变化推挤文档流导致的全局“垂直暴跌/跳动”。

1. **画布工具栏必须悬浮（Floating HUD Only）**：
   - 涂抹消除画笔控制栏必须作为画板底端的**悬浮毛玻璃胶囊（`absolute bottom-3 left-1/2 -translate-x-1/2 z-20`）**；
   - 严禁在图片上方插入静态 Card 块（避免产生 68px 的剧烈下坠重绘）；
2. **通知与错误绝不推挤文档流（Fixed Overlay Notification）**：
   - 错误与全局警告必须采用视口顶部悬浮 Toast（`fixed top-14 left-1/2 -translate-x-1/2 z-50`）；
   - 无论出现还是关闭，主页面所有元素位置绝对纹丝不动；
3. **顶部工具架槽位恒定（Permanent Slot）**：
   - 模型选择与模式控制栏保持高度恒定（44px）；
   - 处理中（Processing）仅通过 `pointer-events-none opacity-50` 锁定，严禁从 DOM 整体卸载导致页面坍缩；
   - 结果态右侧平滑流转为微调/重生成动作，主舞台画布上边缘像素级保持完全一致。
4. **控制栏防挤压、微胶囊与定位隔离规范（Anti-Squeeze & Isolated HUD）**：
   - 涂抹画笔 HUD 必须严格锚定在**画布图像容器内部底端（`relative` 包含块）**，严禁因定位丢失逃逸至视口最底部与全局 `Dock` 导航栏发生重叠；
   - 所有按钮基类必须具备 `whitespace-nowrap shrink-0`，严禁任何中文在弹性盒收缩时被挤压折行成上下竖排；
   - HUD 操作按钮必须采用**实体微胶囊质感（`rounded-full`）**，具备明确的微边框、背景层次与交互回弹反馈，严禁使用散落无边界的 ghost 悬空文本。

