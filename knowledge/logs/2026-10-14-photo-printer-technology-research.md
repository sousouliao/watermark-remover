# 拟真照片打印机：外观参考与技术路线调研

日期：2026-10-14。本文是技术建议，尚未实现、未做运行时性能验证；不代表已决定引入 Three.js。

## 用户选择与外观参考

用户选择陶瓷白概念机器：页面中央摆放实际打印机造型，机身有实体按钮，点击后打印照片；机器是页面主角，不能再弱化成一条抽象出纸口。用户允许机器材质、高光和接触阴影服务于拟真目标。以下为官方产品图与文档调研；外观评价和借鉴方式是本次设计判断，不是厂商结论，也不是购买推荐。

| 参考 | 官方事实与视觉观察 | 对当前概念的用途 |
| --- | --- | --- |
| FUJIFILM instax Link WIDE | 官方设计说明强调柔和曲面、哑光质感、按钮和出纸部位的金属涂层；已查看官方产品图 | 保留柔和白色外壳，金属点缀集中在按钮等少数部位；不照搬立式便携造型 |
| Polaroid Hi·Print 4x6 | 官方规格为 268 × 169 × 66 mm、ABS 外壳、热升华类转印；已查看前部出纸与托盘的官方图 | 参考低矮比例、出纸口与纸张宽度关系、托盘支撑与接缝；不照搬品牌配色 |
| Canon SELPHY QX20 | 已查看官方白色/深色产品图，图中圆形按键、细密表面纹理、接缝和指示灯较克制 | 细节用于增强制造可信度；不为展示细节增加无关按钮 |
| Canon SELPHY CP1500 | 官方规格含相纸盒，手册说明打印时纸张多次经过机身后方 | 参考真实进出纸机构。网页建议压缩为短暂进退、最终出片，不完整复刻真实打印等待；这是体验建议 |

来源：[富士设计说明与产品图](https://design.fujifilm.com/en/consumer/instax-link-wide/)、[Polaroid 产品与规格](https://radio.polaroid.com/en_us/products/hi-print-4x6-printer)、[Canon QX20 官方产品图](https://personal.canon.jp/product/printer/miniphotoprinter/lineup/qx20)、[Canon CP1500 规格](https://downloads.canon.com/selphy/SELPHY-CP1500-Spec-Sheet.pdf)、[Canon CP1500 手册](https://gdlp01.c-wss.com/gds/2/0300044832/01/SELPHY_CP1500_Advanced_User_Guide_EN.pdf)。

已用用户选定图片和三款已查看的官方产品截图生成一张修订概念图：收紧上盖弧度，强调上下壳接缝，减弱出纸口镀铬装饰，补充托盘导向结构。该图仅用于讨论，尚未获选为最终实现目标；真实设备尺寸也尚未转为建模约束。

## 当前项目事实

- `apps/web/package.json` 已有 React 19、Motion 14，未引入 Three.js、React Three Fiber。
- `apps/web/src/pages/XHSApp.tsx` 已提供解析、鉴权预览 Blob、大图预览、单图/ZIP 下载、导入去水印；新体验可沿用这些动作。解析完成与图片 Blob 加载完成是不同阶段，打印照片应等真实图片解码完成。
- `apps/web/src/types/xhs.ts` 的图片字段是 index、previewUrl、downloadUrl，没有宽高；需要在前端解码后取得比例，不能假定所有结果都像概念图一样是横幅照片。

## 结论与取舍

用户选择的画面是固定视角的精品照片打印机。该目标不强制要求实时 3D。决定质感的首先是机身造型、倒角、出纸口深度、材质和布光资产；引入引擎本身不会自动得到概念图的质感。

| 路线 | 适合的目标 | 主要代价与限制 |
| --- | --- | --- |
| 分层渲染资产 + CSS / Motion | 固定镜头、按钮按压、状态灯、照片送出；尽快保持概念图的静态品质 | 需要机身后层、出纸口前层、托盘、按钮和阴影等对齐资产；照片可透视移动，但真实弯曲、换角度与动态光影较难 |
| Three.js + 制作好的 GLB | 纸张自然弯曲、统一遮挡和阴影、视角微动、可复用的实体结构 | 要先制作或取得高质量模型并拆出按钮/托盘；还要材质、灯光、纹理及移动端调优 |

建议最终体验采用 Three.js 固定视角场景：用户重视机器实体感与打印仪式，纸张自然弯曲、接触阴影和轻微镜头变化值得使用统一三维结构。先确定机身与固定镜头，用一张真实结果图完成“按下→准备→送纸→取片”的小样；若建模资产尚未准备好，可先用分层资产 + 现有 Motion 验证节奏。这是设计与实现建议，尚未确认资产和性能。输入、下载、去水印仍由 React DOM 承载。

## Three.js 能做什么

Three.js 的 `MeshStandardMaterial` 使用 PBR 的金属度/粗糙度参数；环境贴图有助于材质表现。GLTFLoader 可以加载已有模型。官方模型和灯光示例证明这些能力，但不保证某个自建模型一定精致。[PBR 文档](https://github.com/mrdoob/three.js/blob/dev/docs/pages/MeshStandardMaterial.html)、[GLTFLoader 源码](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/loaders/GLTFLoader.js)、[模型与环境光示例](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_loader_gltf_anisotropy.html)。

建议将打印机建成机身、按钮、托盘等独立物件。纸张使用有分段的薄面片，通过顶点变形做送纸口附近的小弯曲，靠机身几何形成正确遮挡；照片经 Canvas 合成白边后成为动态纹理。官方示例展示 CanvasTexture 和修改顶点的机制；弯纸轨迹与白边布局仍需本项目实现。[CanvasTexture 示例](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_materials_texture_canvas.html)、[动态几何示例](https://github.com/mrdoob/three.js/blob/dev/manual/examples/custom-buffergeometry-dynamic.html)。

概念生成图是像素图，没有可直接供 GLTFLoader 使用的几何、材质、UV 或物件层级。必须另行建模或准备分层资产；单张图像的三维重建质量不能在本次调研中作保证。

静止时按需渲染，在模型/纹理加载、尺寸变化或交互后更新；送纸期间才连续刷新。官方手册给出了这种方式。[按需渲染](https://github.com/mrdoob/three.js/blob/dev/manual/pages/rendering-on-demand.html)。

## 接入需要处理的真实边界

1. 图片获取继续走现有 `fetchAuthenticatedBlob`。普通 `<img>` 能显示跨域图，不等于 Canvas/WebGL 可用作纹理；服务端必须允许跨域，前端标记 crossOrigin 不能替代服务端许可。现有鉴权 API 获取 Blob 的路线仍需后端正确的 CORS 和认证配置。[浏览器跨域图像约束](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image)。
2. 相纸内照片默认完整显示，按原始比例留白，避免为了套横幅样机把竖图裁掉。展示纹理可按显示尺寸缩小，下载继续返回现有原资源；展示与下载质量分开。
3. 机身按钮的视觉可做成 3D 下沉，但点击入口保留真实 DOM button，提供键盘、焦点和 disabled 状态；固定镜头可把 DOM 按钮贴合模型投影位置。状态文字也保留 DOM，避免因纹理分辨率而模糊。
4. 多图先完整播放第一张，后续节奏加快；无需人为延后 ZIP 下载或去水印动作。解析失败/图片加载失败用真实状态反馈，不能拿模拟出纸当成成功。
5. 分层路线用 Motion 的 transform、关键帧和弹簧控制纸张与按钮，属于现有能力的延伸；精确的出纸遮挡层仍由资产与布局实现。[Motion 动画文档](https://motion.dev/docs/react-animation)。

## 下一步建议

先定机身比例、相纸规格和出纸方式，准备一致视角的机身无纸图与部件资产，或者一个拆件清楚的 GLB；随后只验证首张照片的送纸小样和手机尺寸。通过该小样再接入完整图集，暂不扩展旋转观察、内部机械仿真等功能。
