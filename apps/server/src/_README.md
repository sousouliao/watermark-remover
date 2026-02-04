# 源码目录 (Source Directory)

## 模块定位 (Module Positioning)

这是 Watermark Remover BFF 服务的根源码目录。包含应用入口点、根模块和功能模块。

## 机制 (Mechanisms)

- **入口点**: `main.ts` - 启动 NestJS 应用，配置：
  - 启用 CORS 以支持跨域请求
  - 配置请求体解析器限制为 50mb，用于处理 Base64 图片
  - 设置全局 API 前缀为 `api`
- **根模块**: `app.module.ts` - 编排所有功能模块
- **功能模块**: 按领域组织 (例如 `watermark/`)

## 文件清单 (File Inventory)

- `main.ts` - 应用启动和配置 (CORS, 请求体解析器, 全局前缀)
- `app.module.ts` - 根应用模块
- `app.controller.ts` - 根控制器 (占位符，如果不需要可以删除)
- `app.service.ts` - 根服务 (占位符，如果不需要可以删除)
- `watermark/` - 水印移除功能模块
