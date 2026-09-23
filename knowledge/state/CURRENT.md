# 当前状态

更新：2026-09-23

## 所处阶段

重构路线图与项目知识库已建立；阶段 0 [Issue #1](https://github.com/sousouliao/watermark-remover/issues/1) 的 API 核对和样本评测已完成，Seedream 双模型尚未接入产品。当前产品仍采用“上传 → 手绘蒙版 → IOPaint-LaMA → 对比/下载”的流程，后端调用位于 `apps/server/src/watermark/watermark.service.ts`，前端请求位于 `apps/web/src/hooks/useWatermarkApp.ts`。

## 下一步

执行[阶段 1 Issue #2](https://github.com/sousouliao/watermark-remover/issues/2)：后端调用方舟图像 API，并允许明确选择 Lite 或 Flash。阶段 0 的账号、接入点、80 次真实照片对照与限制见[评测日志](../logs/2026-09-23-phase-0-ark-cli.md)，可复用样本见 [`samples/phase0/`](../../samples/phase0/README.md)。之后按 [#3](https://github.com/sousouliao/watermark-remover/issues/3) → [#4](https://github.com/sousouliao/watermark-remover/issues/4) 推进。

## 当前未确认

- 哪款模型适合作为默认选项；Flash 在阶段 0 的合成水印样本上更快、通常减少框外改动，但局部细节仍有失败案例，需在阶段 3 的实际产品链路中决定。
