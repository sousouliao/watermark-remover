# 2026-10-15 UI 整体重排

## 目标

用户反馈小红书解析页的粘贴按钮与输入框叠加难看，要求重新设计整个 UI/UX。用户确认：可突破 DESIGN.md 并同步修订，全部页面一次改完，`AppDock` 必须保留原样。

## 诊断

- 输入框右端的 `size-11` 方块按钮被塞进 `rounded-full overflow-hidden` 容器，方角与圆角互相切割。
- 圆角共有 `full/xl/lg/2xl/md` 五档；新旧两套按钮（`motion/button.tsx` 与 `motion/button/base.tsx`）同名不同形。
- 编辑态工具栏是胶囊套两组 Tabs 胶囊；处理态是模糊图上叠卡片，卡片内共六层元素；步骤条与页面状态重复。

## 实际改动

- `motion/input.tsx`：右侧插槽改为文档流 flex 子项，不再 `absolute` 覆盖；`motion/button/base.tsx` 的 `icon` 尺寸改为 `size-8 rounded-full`；`motion/alert.tsx` 圆角改为 `rounded-2xl`。
- 新增 `FloatingAlert`（顶部悬浮错误提示）与 `PageHeading`。
- `XHSApp`：输入、粘贴/清空、解析在同一条胶囊内；图集去掉卡片与角标，改为图片加下方序号与下载。
- `WatermarkApp`：移除步骤条和工具栏外层胶囊；处理中仅锁定模型与模式，不卸载。`useWatermarkApp` 删除 `steps`、`currentStepIndex`。
- `ProcessingOverlay`、`ResultViewer`、`ActionBar`、`MaskEditor`、`AppHeader`、登录路由：统一为 `motion/button/base`、两档圆角，删除业务层尺寸覆盖。
- `AppDock`、`app-dock.css` 未修改。
- DESIGN.md 新增 §1.3，并修订 §5.4 的 HUD 按钮规定。

## 验证

- `pnpm -F @watermark-remover/web type-check`：通过。
- `pnpm -F @watermark-remover/web build`：通过。
- 改动文件的 ESLint：无输出。
- 业务层已无 `rounded-md/lg/xl`（grep 确认）。

## 第二轮：移除顶栏，头像并入 Dock

- 用户要求去掉顶栏的 logo 与站名，并把头像放进 Dock。删除 `AppHeader`；`AppDock` 在主题按钮后追加分隔线与头像，点击向上弹出账户菜单（登录名、退出登录），样式沿用 Dock 黑底与参考站细阴影。Dock 的应用切换、主题按钮与展开动效未改。
- 页面顶部改为直接留出 safe-area；`FloatingAlert` 改为距视口顶部 1rem。
- 验证：type-check、build、改动文件 lint 通过。用 ego-browser 打开本地 5173，在页内拦截 `/api/auth/me` 模拟登录（不经后端），截图核对 1280px 与 375px 两种宽度：无顶栏，Dock 宽 365px（手机 343px，无横向溢出），菜单右缘与 Dock 对齐。

## 第三轮：画笔工具移出画布

- 用户反馈画布底部的悬浮工具条难看且挡住涂抹区域；截图中滑块手柄压住“画笔大小”文字，“撤销/清空”被挤成竖排。
- `MaskEditor` 不再在画布上覆盖任何控件，改为画布下方一行三栏：左“换一张”、中画笔工具（仅涂抹模式）、右“消除水印”；两端按钮经 `start`/`end` 传入。删除 `ActionBar`。
- 画笔大小改为四档圆点单选（12/24/40/60px，选中态黑底跟随弹簧），撤销、清空改为图标按钮。`ui/slider` 不再被业务引用。
- 验证：type-check、build、改动文件 lint 通过；ego-browser 模拟登录后上传生成的测试图，1280px 下画布底边 560px、工具顶边 576px（不重叠），375px 无横向溢出；切到 40px 画笔涂一笔后撤销按钮由禁用变为可用。

## 第四轮：初始态居中

- 用户要求两个页面的初始状态都垂直居中。小红书解析未出结果时原本就居中；去水印上传态改为同样的布局：去掉顶部内边距，在扣除底部 239px Dock 模糊区后的空间内居中；进入编辑后恢复顶部对齐。
- 用户表示测试由其自行完成，本轮未做浏览器或构建验证。

## 第五轮：结果视图切换不移位

- 去水印上传态标题改为“图片去水印”，与 Dock 应用名一致（DESIGN.md §1.3）。
- 用户反馈结果页在滑动/并排间切换时下方操作行随高度跳动。`ResultViewer` 改为固定舞台：外层按原图比例、`max-h-[70vh]` 定高，两种视图都 `absolute inset-0` 填满；并排的两张图在舞台内 `object-contain`（窄屏上下排），图注也在舞台内。
- 未做浏览器验证，由用户测试。

## 第六轮：并排视图可点开预览

- 用户反馈并排时图片不能点开预览。`ResultViewer` 并排视图接入与小红书解析相同的 `ImageViewer`：原图与结果两格的图片换成 `ImageViewerThumbnail`，点击后在灯箱中放大查看。
- 灯箱需要图片真实尺寸，组件在 `originalUrl`/`resultUrl` 变化时（含放大两倍与撤销放大）预加载读取；读到之前格子退回普通 `<img>`，格子尺寸始终由固定舞台决定，布局不变。
- 未做浏览器验证，由用户测试。

## 第七轮：登录页重设计

- `routes/index.tsx` 的登录视图去掉 `Card` 外框，与工作台同一语言：页面垂直居中，黑色圆形 logo 加 `PageHeading`（标题 Watermark Remover、一句说明），下方是唯一的主操作。
- 生产环境为一个全宽 `primary` 的 GitHub 登录按钮；开发环境的 Token 登录改为与小红书解析一致的单条胶囊（输入框内嵌“登录”），登录中用 `StatefulButton` 的 loading 态。
- 错误改用顶部 `FloatingAlert`，不再在表单上方插入 Alert，出现时登录区不移位；版权行使用工作台共用的 `AppFooter`。
- 未做浏览器验证，由用户测试。

## DESIGN.md 精简

- 用户认为 DESIGN.md 偏长。137 行精简为约 80 行：删去已无业务引用的 `InlineSlider`/`RangeSlider`、`AnimatedBadge`、`ThemeToggle` 规定（主题切换已由 Dock 承担），`Alert` 与 §5.2 合并呈现位置，§2 教训压缩为一段；新增 §3.5 并排预览与 §5.5 固定舞台。§1.3、§5 编号不变，§3 重新编号，Dock 在 §3.6。

## 剩余问题

- 处理中与结果两个状态需要真实后端调用，尚未目视验收。
- `components/ui/slider`、`components/ui/button` 与旧 `motion/button.tsx` 已无业务引用（`ui/button` 依赖 `motion/button.tsx`），可在确认后一并清理。
