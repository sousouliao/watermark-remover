# 当前状态

更新：2026-09-24

## 所处阶段

阶段 0 [Issue #1](https://github.com/sousouliao/watermark-remover/issues/1) 的 API 核对和样本评测已完成。阶段 1 [Issue #2](https://github.com/sousouliao/watermark-remover/issues/2) 的后端已接入方舟双模型，支持明确选择、直接/指定区域处理及错误转换；构建、聚焦测试和同一后端接口对 Lite、Flash 的真实图像编辑调用均已通过。前端仍发送旧蒙版请求，当前页面流程需等待阶段 2 接入新接口。

## 下一步

执行[阶段 2 Issue #3](https://github.com/sousouliao/watermark-remover/issues/3)，把前端接入新的请求格式和两种操作模式。部署或本地常规运行前，需按 `apps/server/.env.example` 提供服务端 API Key 与两个接入点；本次真实验收只在临时测试进程中注入现有密钥，没有创建项目 `.env`。阶段 0 账号、接入点和样本见[评测日志](../logs/2026-09-23-phase-0-ark-cli.md)。

## 当前未确认

- 哪款模型适合作为默认选项；Flash 在阶段 0 的合成水印样本上更快、通常减少框外改动，但局部细节仍有失败案例，需在阶段 3 的实际产品链路中决定。
