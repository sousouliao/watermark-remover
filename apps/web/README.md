# React + TypeScript + Vite SPA

前端采用 React 19、TanStack Router 文件路由、TanStack Query、Zustand 5、Tailwind 4 与 Radix React UI primitives。GitHub PKCE 登录后提供完整的上传、双模型选择、直接/指定区域去水印、结果对比、重试、下载与高清增强流程。入口、页面和组件均使用 TS/TSX，业务 hooks 纳入 TypeScript 类型检查。图标使用 lucide-react。

从仓库根目录执行：

```sh
pnpm install
pnpm --filter @watermark-remover/web dev
pnpm --filter @watermark-remover/web type-check
pnpm --filter @watermark-remover/web build
```

Vite 启动或构建时由 `@tanstack/router-plugin` 生成 `src/routeTree.gen.ts`，请勿手动编辑。API 基址由 `VITE_API_BASE_URL` 配置；开发环境 `/api` 代理至 `http://127.0.0.1:3000`。部署使用根目录 `vercel.json` 的 SPA 回退配置。

Vercel 构建命令为 `pnpm --filter @watermark-remover/web build`，输出目录为 `apps/web/dist`。迁移与文档清理记录见 [PASS 3](../../knowledge/logs/2026-10-13-react-pass-3.md)。
