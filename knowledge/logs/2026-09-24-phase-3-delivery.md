# 2026-09-24 · 阶段 3：旧实现清理与本地复核

按路线图 Issue #4 核对去水印运行链路：水印后端已只调用方舟 API，前端已发送原图、模型和模式，不再传二值蒙版；代码与环境示例中没有 IOPaint/LaMA 配置。保留 `@gradio/client`，因为现有图片放大功能仍使用它。删除水印模块说明中的过期阶段文字，将进度提示从自动检测 / inpainting 改为当前 Seedream 处理流程；更新 README 的默认模型、目录结构与接入点配置说明，环境示例不再填入某个账号的接入点 ID。

从阶段 0 的许可样本中选取 01（角落文字）、02（半透明文字）、03（大块 Logo）、04（中央文字）、19（花心细节），经本地 `/api/watermark/remove` 对 Lite/Flash × 直接/指定区域各调用一次，共 20 次。20 次均返回 HTTP 200、正确模型字段和 2048×2048 PNG，无超时或 API 失败。Lite 10 次请求中位耗时 32.73 秒，Flash 为 22.61 秒；按阶段 0 记录的目录价估算本轮上限 ¥3.40，实际账单未核对。逐张目视检查压缩拼图，五张水印均未见可辨残留；03 的大块遮挡区域由模型重建，04 的草木和亮度发生重绘。19 中 Flash 两模式均抹平花心颗粒，Lite 保留更多可见纹理。图片和逐次状态见[对照报告](../../reports/model-eval/2026-09-24-product-path/index.html)，原始 2K 输出仅在本机临时目录 `/private/tmp/watermark-phase3-2026-09-24/`。据此作出[默认 Lite 决策](../decisions/0002-default-seedream-lite.md)。

验证：本地服务 `/api/health` 返回成功；以上 20 次请求覆盖两模型和两模式的真实后端链路；`pnpm -F @watermark-remover/server build`、`pnpm -F @watermark-remover/web build`、受影响前端文件 ESLint 与 `git diff --check` 通过。阶段 2 已验证真实页面四条路径、结果对比和下载，本轮没有改动这些交互。仓库未配置目标部署环境，目标环境的完整流程尚未验收。
