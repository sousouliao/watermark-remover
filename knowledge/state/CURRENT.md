# 当前状态

更新：2026-09-24

## 所处阶段

阶段 0 [Issue #1](https://github.com/sousouliao/watermark-remover/issues/1) 的 API 核对和样本评测已完成。阶段 1 [Issue #2](https://github.com/sousouliao/watermark-remover/issues/2) 的后端双模型接口已通过真实调用验收。阶段 2 [Issue #3](https://github.com/sousouliao/watermark-remover/issues/3) 的前端已接入模型选择、直接/指定区域处理、结果对比、重试与下载；前端构建、浏览器模拟交互及 Lite/Flash × 直接/指定区域的四条真实页面路径均已通过验收。

## 下一步

执行[阶段 3 Issue #4](https://github.com/sousouliao/watermark-remover/issues/4)的旧依赖清理、样本复核和默认模型决定。正式运行时服务端仍需按 `apps/server/.env.example` 配置密钥和接入点；阶段 0 的账号、接入点和样本见[评测日志](../logs/2026-09-23-phase-0-ark-cli.md)。

## 当前未确认

- 哪款模型适合作为默认选项；Flash 在阶段 0 的合成水印样本上更快、通常减少框外改动，但局部细节仍有失败案例，需在阶段 3 的实际产品链路中决定。
