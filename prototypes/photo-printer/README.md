# 照片打印机单片样机

T1 固定视角交互原型。使用透明机身图片与 Three.js 相纸验证已选造型和打印节奏；没有完整 GLB 机身，也不调用小红书解析接口。

## 本地运行

在本目录执行：

```sh
npm ci
npm run dev -- --port 4173 --strictPort
```

浏览器打开 `http://localhost:4173/`，点击机身右侧实体按钮或「开始打印」，体验启动、出纸、取片、预览、下载和重播。默认使用生成的沿海照片；也实现了本地选图入口。

```sh
npm run build
```

构建输出为 `dist/client`。保留 Product Design 模板的 Sites 构建文件，目前只做本地预览，未发布。

## 进度与验证

- [项目任务清单](../../knowledge/photo-printer-plan.md)：T1–T4 的范围和验收。
- [设计检查](design-qa.md)：桌面/手机截图、设计对照与交互验证。
- [技术和外观调研](../../knowledge/logs/2026-10-14-photo-printer-technology-research.md)。

已检查示例照片核心路径。IAB 本地文件选择器自动化超时，本地选图尚未自动验收。当前独立原型包含 Three.js 大于500kB的构建提示，尚未验证真实移动设备运行性能。

`public/assets/printer-body.png` 和 `sample-coast.png` 为本次通过 ImageGen 生成的资产；`qa/reference.png` 是用户选定的概念参考。图片、截图均为示例/生成内容，不含私人原图。
