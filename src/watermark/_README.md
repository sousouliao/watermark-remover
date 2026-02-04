# 水印模块 (Watermark Module)

## 模块定位 (Module Positioning)
该模块通过集成 Hugging Face 的 SDXL Inpainting Space 处理水印移除功能。为客户端 (Web/iOS) 提供 REST API 端点，用于提交图片和蒙版进行水印移除。

## 机制 (Mechanisms)
- **DTO 层**: 使用 `image` 和 `mask` 字段验证传入请求 (Base64 或 URL)
- **服务层**: 使用 `@gradio/client` 连接 Hugging Face Space 并处理图片
- **控制器层**: 暴露 `POST /api/watermark/remove` 端点
- **集成**: 使用 `diffusers/stable-diffusion-xl-inpainting` Space，具有特定的参数映射

## 文件清单 (File Inventory)
- `watermark.module.ts` - 注册控制器和服务的模块定义
- `watermark.controller.ts` - 水印移除端点的 REST API 控制器
- `watermark.service.ts` - 连接 Hugging Face 和处理图片的业务逻辑
- `dto/remove-watermark.dto.ts` - 用于请求验证的数据传输对象
