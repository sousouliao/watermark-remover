# 当前状态

更新：2026-09-23

## 所处阶段

重构路线图与项目知识库已建立；Seedream 双模型尚未接入。当前产品仍采用“上传 → 手绘蒙版 → IOPaint-LaMA → 对比/下载”的流程，后端调用位于 `apps/server/src/watermark/watermark.service.ts`，前端请求位于 `apps/web/src/hooks/useWatermarkApp.ts`。

## 下一步

执行[阶段 0 Issue #1](https://github.com/sousouliao/watermark-remover/issues/1)：在火山方舟核实 Lite、Flash 的可用模型 ID、调用格式和计费，用真实图片建立两模型的去水印与保真对照。后续按 [#2](https://github.com/sousouliao/watermark-remover/issues/2) → [#3](https://github.com/sousouliao/watermark-remover/issues/3) → [#4](https://github.com/sousouliao/watermark-remover/issues/4) 推进。

## 当前未确认

- Lite 在当前方舟账号中应使用的准确模型 ID，以及它与文档中两个写法的关系。
- Flash 的实际价格、账号开通状态和两种区域指示方式的效果。
- 哪款模型适合作为默认选项；以真实样本的非目标区域保真情况决定。
