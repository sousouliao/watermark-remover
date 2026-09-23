# Watermark Remover

AI 驱动的图片水印移除工具。上传图片、标记水印区域、一键移除，即刻下载干净图片。

新版重构与 Seedream 5.0 Lite / Flash 双模型接入计划见[路线图](./knowledge/roadmap.md)；开发过程与项目约定从[知识库](./knowledge/README.md)进入。

## 项目概览

本项目采用 **Monorepo** 架构，包含前端 Web 应用和后端 BFF 服务：

| 应用 | 技术栈 | 说明 |
|------|--------|------|
| `apps/web` | Vue 3 + Tailwind CSS v4 + shadcn-vue | 前端交互界面 |
| `apps/server` | NestJS + TypeScript | 后端 BFF 服务 |

## 功能特性

- **图片上传** — 拖拽或点击上传，支持 PNG、JPG、WEBP 格式（最大 10MB）
- **蒙版编辑** — 画笔标记水印区域，支持调整画笔大小、撤销、清除
- **AI 移除** — 调用 AI Inpainting 模型自动移除水印
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
- **AI 集成**: `@gradio/client` (Hugging Face Space)
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

```bash
# 同时启动前端和后端
pnpm dev

# 或分别启动
pnpm start:web      # 前端 (http://localhost:5173)
pnpm start:server   # 后端 (http://localhost:3000)
```

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
│   │   │   ├── components/
│   │   │   │   ├── WatermarkApp.vue  # 主应用容器（步骤管理）
│   │   │   │   ├── AppHeader.vue     # 头部（Logo + 标题 + 主题切换）
│   │   │   │   ├── AppFooter.vue     # 底部
│   │   │   │   ├── ThemeToggle.vue   # 暗黑模式切换
│   │   │   │   ├── ImageUploader.vue # 图片上传（拖拽 + 点击）
│   │   │   │   ├── MaskEditor.vue    # 蒙版编辑器（画笔绘制）
│   │   │   │   ├── ActionBar.vue     # 操作栏（Reset + Remove）
│   │   │   │   ├── ProcessingOverlay.vue # 处理中动画
│   │   │   │   ├── ResultViewer.vue  # 结果对比查看器
│   │   │   │   └── ui/              # shadcn-vue UI 组件
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

使用 AI Inpainting 移除图片中的水印。

**请求体:**

```json
{
  "image": "data:image/png;base64,...",
  "mask": "data:image/png;base64,..."
}
```

**响应:**

```json
{
  "success": true,
  "data": {
    "image": "data:image/png;base64,..."
  }
}
```

### GET /api/health

健康检查接口。

## 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3000` | 后端服务端口 |
| CORS | 全部来源 | 跨域配置 |
| Body 限制 | 50MB | Base64 图片请求体上限 |

## 许可证

MIT
