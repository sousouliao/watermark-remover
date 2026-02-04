# Role (角色设定)
你是一名崇尚“分形架构 (Fractal Architecture)”的资深 NestJS 后端架构师。

# Project Context (项目来龙去脉)
我们要从零构建一个名为 **"Watermark Remover BFF"** 的后端服务。
1.  **背景:** 用户拥有一台腾讯云轻量服务器 (2核 2G 3Mbps)，资源极其有限，因此不能在本地运行 AI 模型。
2.  **核心功能:** 这是一个 BFF (Backend for Frontend) 层，负责接收客户端（Web 网页 或 iOS 快捷指令）上传的图片和 Mask（蒙版）。
3.  **AI 引擎:** 为了获取高质量的去水印效果且无需支付高昂费用，我们最终选定调用 **Hugging Face** 上的 **SDXL Inpainting Space** (`diffusers/stable-diffusion-xl-inpainting`) 作为计算引擎。
4.  **架构风格:** 采用 "Vibe Coding" / "分形架构" —— 强调代码的自解释性、文档的局部性（Local Documentation）和递归维护。

# Tech Stack (技术栈)
- **Framework:** NestJS (最新版)
- **Language:** TypeScript
- **External Client:** `@gradio/client` (用于连接 Hugging Face Space)
- **Environment:** Node.js v18+

# Implementation Steps (执行计划)

请一步步执行以下操作，每一步完成后等待我确认，再进行下一步：

## Phase 1: 基础设施与分形初始化
1.  使用 Nest CLI 初始化新项目 `watermark-server` (如果当前目录为空，则在当前目录初始化)。
2.  **关键步骤:** 创建项目根目录的 `.cursorrules` 文件。将以下“分形法则”写入其中：
    * **文件头法则:** 所有 `.ts` 文件必须包含 `@file`, `@description`, `@input` (依赖), `@output` (输出), `@pos` (系统定位) 的注释块。
    * **文件夹法则:** 每个目录 (src, src/xxx) 必须包含 `_README.md`，描述该模块的定位、机制和文件清单。
    * **更新法则:** 修改代码必须同步更新上述文档。
3.  根据上述规则，初始化 `src/` 目录下的 `_README.md`，并重写 `main.ts` 和 `app.module.ts` 的文件头。

## Phase 2: 核心配置与依赖
1.  安装依赖: `npm install @gradio/client class-validator class-transformer`。
2.  配置 `main.ts`:
    * 开启 CORS (允许跨域)。
    * **至关重要:** 配置 BodyParser 限制为 `'50mb'` (因为要处理 Base64 图片)。
    * 设置全局前缀 `api`。
3.  更新 `src/_README.md` 和 `main.ts` 的文件头以反映这些配置。

## Phase 3: 业务逻辑实现 (The SDXL Engine)
1.  创建 `WatermarkModule` (包含 Controller, Service, DTO)。
2.  **编写 DTO (`remove-watermark.dto.ts`):**
    * 接收 `image` (Base64/URL) 和 `mask` (Base64/URL)。
3.  **编写 Service (`watermark.service.ts`):**
    * 引入 `@gradio/client`。
    * 实现 `removeWatermark` 方法。
    * **连接目标:** `diffusers/stable-diffusion-xl-inpainting`。
    * **参数映射:** 该 Space 需要特定的参数顺序：
        - Prompt: "high quality, realistic, clean background"
        - Negative Prompt: "watermark, text, blurry, artifacts, distortion"
        - Image (原图)
        - Mask (蒙版)
        - Width: 1024
        - Height: 1024
        - Guidance Scale: 7.5
        - Steps: 30
    * **注意:** 需处理异步调用和错误捕获。
4.  **编写 Controller (`watermark.controller.ts`):**
    * 暴露 `POST /watermark/remove` 接口。
5.  **分形检查:** 确保新创建的 `src/watermark/` 目录下生成了 `_README.md`，且所有新文件的头部注释已填写。

## Phase 4: 验证
1.  生成一个 `curl` 测试命令示例，放在 `README.md` 中，用于验证接口连通性。

---

**现在的首要任务是执行 Phase 1。请开始初始化项目并创建 `.cursorrules`。**
