# Watermark Remover

AI 驱动的图片水印移除工具。上传图片后选择 Seedream 5.0 Lite 或 Flash，可直接处理或标记水印区域，检查结果后下载。

新版重构与 Seedream 5.0 Lite / Flash 双模型接入计划见[路线图](./knowledge/roadmap.md)；开发过程与项目约定从[知识库](./knowledge/README.md)进入。

## 项目概览

本项目采用 **Monorepo** 架构，包含前端 Web 应用和后端 BFF 服务：

| 应用 | 技术栈 | 说明 |
|------|--------|------|
| `apps/web` | Vue 3 + Tailwind CSS v4 + shadcn-vue | 前端交互界面 |
| `apps/server` | NestJS + TypeScript | 后端 BFF 服务 |

## 功能特性

- **图片上传** — 拖拽或点击上传，支持 PNG、JPG、WEBP 格式（最大 10MB）
- **指定区域** — 画笔标记水印位置，支持调整画笔大小、撤销、清除；也可不标记直接处理
- **AI 移除** — 默认使用 Seedream 5.0 Lite，也可选择 Flash 处理图片
- **结果对比** — 滑块对比视图 / 并排视图，直观查看效果
- **暗黑模式** — 支持亮色/暗色主题切换
- **响应式布局** — 适配桌面端和移动端

## 技术栈

### 前端 (`apps/web`)

- **框架**: Vue 3 (Composition API + `<script setup>`)
- **构建工具**: Vite 7
- **样式**: Tailwind CSS v4 + tw-animate-css
- **UI 组件**: shadcn-vue (radix-vue)
- **图标**: lucide-vue-next
- **语言**: TypeScript

### 后端 (`apps/server`)

- **框架**: NestJS
- **语言**: TypeScript
- **AI 集成**: 方舟 Seedream 图像 API；图片放大功能使用 `@gradio/client`
- **运行环境**: Node.js v20+

### 工程化

- **包管理**: pnpm (Workspace)
- **代码规范**: ESLint (@antfu/eslint-config)
- **提交规范**: Commitlint + Husky + lint-staged
- **类型检查**: vue-tsc

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 10

### 安装依赖

```bash
pnpm install
```

### 启动开发

先在 `apps/server/.env` 中配置 `ARK_API_KEY`、`ARK_SEEDREAM_LITE_ENDPOINT` 和 `ARK_SEEDREAM_FLASH_ENDPOINT`；可参照 [`apps/server/.env.example`](./apps/server/.env.example)。两个接入点分别填写当前账号可用的 Lite / Flash `ep-...` ID。已有 `.env` 时直接补充这三项，不要覆盖原有配置。密钥只供后端读取，不要放入前端环境变量。

```bash
# 同时启动前端和后端
pnpm dev

# 或分别启动
pnpm start:web      # 前端 (http://localhost:5173)
pnpm start:server   # 后端 (http://localhost:3000)
```

如果页面提示无法连接图像服务，先打开 `http://localhost:3000/api/health`：无法访问表示后端没有启动；返回 `status: ok` 后仍无法处理图片，再检查 `apps/server/.env` 中的三项方舟配置。仅启动前端无法处理图片。

### 构建

```bash
pnpm build
```

## 项目结构

```
watermark-remover/
├── apps/
│   ├── web/                          # 前端 Vue 应用
│   │   ├── src/
│   │   │   ├── App.vue               # 根组件（背景渐变 + 布局）
│   │   │   ├── main.ts               # 应用入口
│   │   │   ├── style.css             # 全局样式 + CSS 变量
│   │   │   ├── pages/WatermarkApp.vue # 主页面与步骤管理
│   │   │   ├── components/
│   │   │   │   ├── MaskEditor/       # 指定区域画笔
│   │   │   │   ├── ResultViewer/     # 结果对比与下载
│   │   │   │   └── ui/               # UI 基础组件
│   │   │   └── lib/
│   │   │       └── utils.ts          # 工具函数
│   │   ├── components.json           # shadcn-vue 配置
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── server/                       # 后端 NestJS 服务
│       └── src/
│           ├── main.ts               # 应用入口
│           ├── app.module.ts         # 根模块
│           ├── health/               # 健康检查
│           ├── watermark/            # 水印移除模块
│           │   ├── watermark.controller.ts
│           │   ├── watermark.service.ts
│           │   └── dto/
│           └── common/               # 公共定义
│               └── dto/
├── package.json                      # Monorepo 根配置
├── pnpm-workspace.yaml
└── eslint.config.js
```

## API 接口

### POST /api/watermark/remove

通过方舟 Seedream 5.0 Lite 或 Flash 移除图片中的水印。前端的直接处理和指定区域处理均使用此接口。

**请求体:**

```json
{
  "image": "data:image/png;base64,...",
  "model": "flash",
  "mode": "direct"
}
```

`image` 支持 PNG、JPEG、WebP 的 Base64 data URI，原图最大 30 MB。API 请求的 `model` 必须明确填写 `lite` 或 `flash`；网页默认发送 `lite`，用户可切换为 `flash`。指定区域时将 `mode` 改为 `region`，并传入按原图归一化到 0–999 的坐标：

```json
{
  "image": "data:image/png;base64,...",
  "model": "flash",
  "mode": "region",
  "region": { "x1": 205, "y1": 341, "x2": 795, "y2": 644 }
}
```

指定区域只用于提示模型，不能保证框外像素不变。请求超时为 120 秒；失败时返回标准 HTTP 错误状态和可读的 `message`，不会自动切换模型重试。

**响应:**

```json
{
  "success": true,
  "data": {
    "image": "data:image/png;base64,...",
    "model": "flash"
  }
}
```

### GET /api/health

健康检查接口。

## 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3000` | 后端服务端口 |
| `ARK_API_KEY` | 无 | 服务端方舟 API Key |
| `ARK_SEEDREAM_LITE_ENDPOINT` | 无 | Lite 接入点 ID |
| `ARK_SEEDREAM_FLASH_ENDPOINT` | 无 | Flash 接入点 ID |
| CORS | 全部来源 | 跨域配置 |
| Body 限制 | 50MB | Base64 图片请求体上限 |

本地配置示例见 [`apps/server/.env.example`](./apps/server/.env.example)。密钥只保存在服务端环境中。

## 许可证

MIT
