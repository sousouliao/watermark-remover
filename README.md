# Watermark Remover

AI 驱动的图片水印移除工具。上传图片后选择 Seedream 5.0 Lite 或 Flash，可直接处理或标记水印区域，检查结果后下载。

新版重构与 Seedream 5.0 Lite / Flash 双模型接入计划见[路线图](./knowledge/roadmap.md)；开发过程与项目约定从[知识库](./knowledge/README.md)进入。

## 项目概览

本项目采用 **Monorepo** 架构，包含前端 Web 应用和后端 BFF 服务：

| 应用 | 技术栈 | 说明 |
|------|--------|------|
| `apps/web` | React 19 + TanStack Router/Query + Zustand 5 + Tailwind CSS v4 | 前端交互界面 |
| `apps/server` | Go + net/http | 后端 BFF 服务 |

## 功能特性

- **图片上传** — 拖拽或点击上传，支持 PNG、JPG、WEBP 格式（最大 10MB）
- **指定区域** — 画笔标记水印位置，支持调整画笔大小、撤销、清除；也可不标记直接处理
- **AI 移除** — 默认使用 Seedream 5.0 Lite，也可选择 Flash 处理图片
- **结果对比** — 滑块对比视图 / 并排视图，直观查看效果
- **暗黑模式** — 支持亮色/暗色主题切换
- **响应式布局** — 适配桌面端和移动端

## 技术栈

### 前端 (`apps/web`)

- **框架**: React 19 SPA
- **构建工具**: Vite 8
- **样式**: Tailwind CSS v4 + tw-animate-css
- **路由与请求状态**: TanStack Router 文件路由 + TanStack Query
- **客户端状态**: Zustand 5
- **UI 组件**: Radix React primitives + shadcn 风格 TSX 组件
- **图标**: lucide-react
- **语言**: TypeScript

### 后端 (`apps/server`)

- **HTTP**: Go 标准库 `net/http`
- **语言与工具链**: Go 1.27.2
- **AI 集成**: 方舟 Seedream 图像 API；Gradio HTTP 图片放大
- **身份**: GitHub OAuth + PKCE，仅允许指定用户 ID
- **解析**: 同机 XHS-Downloader 2.8，提供单图与 ZIP 下载接口

### 工程化

- **包管理**: pnpm (Workspace)
- **代码规范**: ESLint (@antfu/eslint-config)
- **提交规范**: Commitlint + Husky + lint-staged
- **类型检查**: TypeScript（`pnpm --filter @watermark-remover/web type-check`；前端构建先执行 `tsc -b`）

## 快速开始

### 环境要求

- Node.js >= 22.22
- Go 1.27.2
- pnpm >= 10

### 安装依赖

```bash
pnpm install
```

### 启动开发

日常前端开发只需启动 Web，默认通过 Vite 代理连接正式后端，无需本地启动 Go：

```bash
pnpm start:web      # 前端 (http://localhost:5173)，API 使用正式后端
```

先在[正式站](https://watermark-remover-ui.vercel.app)登录，再从开发者工具 → Application → Session Storage 复制 `watermark-session`，通过本地登录页「导入线上会话」进入。正式 OAuth 回调固定在线上；本地导入的是真实会话，处理和下载请求也使用正式服务。

调试 Go 时，在 `apps/web/.env.local` 中设置 `DEV_API_TARGET=http://127.0.0.1:3000`，重启 Web，再执行 `pnpm start:server`（或 `pnpm dev` 同时启动两者）。按[后端配置与接口](./apps/server/README.md)配置 `apps/server/.env`；密钥只供后端读取，不要放入前端环境变量。详情见 [Web 开发说明](./apps/web/README.md)。

### 构建

```bash
pnpm build
```

## 项目结构

```
watermark-remover/
├── apps/
│   ├── web/                          # 前端 React SPA
│   │   ├── src/
│   │   │   ├── main.tsx              # React 应用入口
│   │   │   ├── routes/               # 文件路由（/ 与 /auth/callback）
│   │   │   ├── routeTree.gen.ts       # 自动生成的路由树
│   │   │   ├── style.css             # 全局样式 + CSS 变量
│   │   │   ├── pages/WatermarkApp.tsx # 主页面与步骤管理
│   │   │   ├── components/
│   │   │   │   ├── MaskEditor/       # 指定区域画笔
│   │   │   │   ├── ResultViewer/     # 结果对比与下载
│   │   │   │   └── ui/               # UI 基础组件
│   │   │   ├── stores/auth.ts        # Zustand 会话与认证
│   │   │   └── lib/
│   │   │       └── utils.ts          # 工具函数
│   │   ├── components.json           # shadcn React 配置
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── server/                       # Go API
│       ├── cmd/server/main.go        # 启动入口
│       ├── internal/                # 按功能组织的服务实现
│       ├── go.mod / go.sum           # Go 依赖锁定
│       └── package.json             # pnpm 开发/构建命令桥接
├── package.json                      # Monorepo 根配置
├── pnpm-workspace.yaml
└── eslint.config.mjs
```

## API 接口

业务接口需要本应用 Bearer 会话；成功响应兼容旧接口。GitHub 登录、小红书解析/单图/ZIP 完整接口见[后端文档](./apps/server/README.md)，分离部署见[部署说明](./deploy/README.md)。

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
| `FRONTEND_URL` | `http://localhost:5173` | 精确 CORS 来源及 OAuth 回调 origin |
| `XHS_API_URL` | `http://127.0.0.1:5556` | 同机解析服务 |
| `GITHUB_ALLOWED_USER_ID` | `37927306` | 唯一允许登录身份 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 无 | 服务端 OAuth 配置 |
| Body 限制 | 50MB | Base64 图片请求体上限 |

本地配置示例见 [`apps/server/.env.example`](./apps/server/.env.example)。密钥只保存在服务端环境中。

## 许可证

MIT
