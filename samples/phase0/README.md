# 阶段 0 图像样本

用于 [Issue #1](https://github.com/sousouliao/watermark-remover/issues/1) 的双模型对照，共 20 张真实照片。照片取自 Wikimedia Commons，来源页和许可见 [`manifest.json`](manifest.json)；只选 Commons 标注为 CC0 或 Public domain 的文件。每张照片裁切并缩放为 1024×1024：`NN-clean.jpg` 是未加标记的参考图，`NN-marked.jpg` 是本项目合成覆盖文字后的待处理图。

四类覆盖各五张：`corner_text`（角落小字）、`semi_transparent`（半透明文字）、`large_logo`（大块标识）、`central_text`（中央文字）。清单中 `watermark_bbox_px` 是 1024×1024 图片上的像素坐标，`watermark_bbox_norm` 是供 `<bbox>` 提示词使用的 0–999 坐标，`marked_sha256` 用于核对待处理输入图。

这些是有干净参考图的**合成水印样本**，便于比较去除效果和非目标区域变化；它们不能代表所有真实第三方水印。80 次请求的状态、耗时、输出尺寸和辅助像素差异见 [`evaluation.json`](evaluation.json)。[离线 HTML 报告](../../reports/model-eval/2026-09-23-seedream-5/index.html)包含输入图、干净参照和四路结果的压缩预览。原始模型生成图与含时效性链接的 API 响应不在仓库中，评测结论见[阶段 0 日志](../../knowledge/logs/2026-09-23-phase-0-ark-cli.md)。新模型按[统一评测流程](../../knowledge/model-evaluation.md)复用这批样本。
