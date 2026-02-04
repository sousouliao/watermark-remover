# 水印移除 BFF (Watermark Remover BFF)

一个 NestJS 后端服务 (Backend for Frontend, BFF)，通过利用 Hugging Face 的 SDXL Inpainting Space 从图片中移除水印。该服务设计用于在资源受限的服务器上运行 (例如 2 核 2GB 内存)，为 Web 和 iOS 客户端提供 REST API。

## 架构

本项目遵循**分形架构 (Fractal Architecture)** 原则：

- 所有 `.ts` 文件包含带有 `@file`、`@description`、`@input`、`@output` 和 `@pos` 标签的完整文件头
- 每个目录包含一个 `_README.md`，描述模块定位、机制和文件清单
- 代码更改与文档同步

## 技术栈

- **框架**: NestJS (最新版)
- **语言**: TypeScript
- **外部客户端**: `@gradio/client` (用于 Hugging Face Space 集成)
- **环境**: Node.js v18+

## 功能特性

- 用于水印移除的 REST API 端点
- 集成 Hugging Face SDXL Inpainting Space
- 支持 Base64 编码的图片和蒙版
- 启用 CORS 以支持跨域请求
- 大负载支持 (Base64 图片限制为 50mb)

## 项目设置

```bash
# 安装依赖
npm install

# 开发模式
npm run start:dev

# 生产模式
npm run start:prod
```

## API 端点

### POST /api/watermark/remove

使用提供的蒙版从图片中移除水印。

**请求体:**

```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS...", // Base64 编码的图片或 URL
  "mask": "data:image/png;base64,iVBORw0KGgoAAAANS..." // Base64 编码的蒙版或 URL
}
```

**响应:**

```json
{
  "success": true,
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS..." // 处理后的图片
}
```

## 测试

### 使用 curl

```bash
curl -X POST http://localhost:3000/api/watermark/remove \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/png;base64,YOUR_BASE64_IMAGE_HERE",
    "mask": "data:image/png;base64,YOUR_BASE64_MASK_HERE"
  }'
```

### 使用实际 Base64 数据的示例

将 `YOUR_BASE64_IMAGE_HERE` 和 `YOUR_BASE64_MASK_HERE` 替换为实际的 Base64 编码图片数据：

```bash
curl -X POST http://localhost:3000/api/watermark/remove \
  -H "Content-Type: application/json" \
  -d @- << EOF
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "mask": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
EOF
```

## 配置

服务配置如下：

- **CORS**: 为所有来源启用
- **请求体解析器限制**: 50mb (用于 Base64 图片处理)
- **全局 API 前缀**: `api`
- **端口**: 3000 (可通过 `PORT` 环境变量配置)

## Hugging Face 集成

服务连接到 `diffusers/stable-diffusion-xl-inpainting` Space，使用以下参数：

- **提示词**: "high quality, realistic, clean background"
- **负面提示词**: "watermark, text, blurry, artifacts, distortion"
- **宽度**: 1024
- **高度**: 1024
- **引导比例**: 7.5
- **步数**: 30

## 项目结构

```
src/
├── _README.md              # 源码目录文档
├── main.ts                 # 应用入口点
├── app.module.ts           # 根模块
├── app.controller.ts      # 根控制器
├── app.service.ts          # 根服务
└── watermark/              # 水印移除模块
    ├── _README.md          # 模块文档
    ├── watermark.module.ts
    ├── watermark.controller.ts
    ├── watermark.service.ts
    └── dto/
        └── remove-watermark.dto.ts
```

## 许可证

MIT
