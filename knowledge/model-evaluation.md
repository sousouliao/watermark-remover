# 新图像模型接入评测流程

适用范围：给 Watermark Remover 增加或替换图像编辑模型时，先用相同的样本、请求条件和报告口径做可复核对照。首次使用的基线是 [`samples/phase0/`](../samples/phase0/README.md)。本流程衡量图像去水印能力；结论不自动替代产品链路验收。

## 1. 固定输入与比较条件

- 默认复用 20 张真实照片的干净图、合成水印图和区域坐标。新增样本时须确认使用权，保留来源页、许可、干净参照图、待处理图、像素与 0–999 区域坐标，以及待处理图 SHA-256。先把方向与裁切烘焙进图片，避免 EXIF 方向改变区域含义。
- 每个候选模型处理**同一批图**，每张各请求一次直接编辑、一次 `<bbox>` 指定区域编辑，每次只输出一张。默认规格为 `2K`、PNG、`response_format=url`、`watermark=false`；提示词使用同一份配置模板。若新模型不支持任一条件，应记录差异并重新设计该轮的共同条件，不悄悄降低某一模型的输入或输出规格。
- 若要与过去的模型结果比较，应在同一轮重新请求基线模型。跨日期复用旧结果可以用于探索，但价格、服务版本和环境不同，报告应标明这种限制。

## 2. 提交请求前

1. 查官方文档和当前账号：模型版本、输入限制、输出格式、区域定位、价格、开通状态；用 Ark CLI 确认登录、接入点为 `Running`、模态为 `image`、所用参数受支持。不要把模型名当成 platform profile 的接入点 ID。
2. 复制 [`config.example.json`](../tools/model_eval/config.example.json) 到本次运行目录，填入日期、模型键、实际 `ep-...`、当前目录单价和共同请求参数。账号密钥由 Ark CLI profile 持有，不写进配置或报告。模型列表和提示词一经开始本轮请求就保持不变。
3. 计算整批上限：`样本数 × 2 种方式 × 各模型每张目录价之和`；单独查询免费资源包，不能把尚未同步的余额当成预留额度。给执行器传入不低于目录价上限的 `--max-cost-cny`。先运行 `--dry-run` 核对任务数、样本文件和预算；它不访问 Ark。

## 3. 执行与留痕

使用带 Pillow 的 Python（依赖见 [`requirements.txt`](../tools/model_eval/requirements.txt)）。例如新一轮运行：

```bash
python3 tools/model_eval/run.py \
  --manifest samples/phase0/manifest.json \
  --config /path/to/this-run-config.json \
  --output-dir /path/to/this-run \
  --max-cost-cny 15 --workers 2 --dry-run

MODEL_EVAL_CALLER_NAME=codex python3 tools/model_eval/run.py \
  --manifest samples/phase0/manifest.json \
  --config /path/to/this-run-config.json \
  --output-dir /path/to/this-run \
  --max-cost-cny 15 --workers 2
```

`MODEL_EVAL_CALLER_NAME` 供 AI Agent 标记 Ark CLI 调用来源；人工运行时可省略。执行器提交前重新核对登录、接入点与参数能力；每次结果立即写入 `evaluation.json`，图片放在 `outputs/`。重新运行同一目录时跳过所有已记录请求，包含失败项；超时或下载结果不明时停下，先人工核对是否已计费，再决定是否在新运行中重试。不要自动换模型、密钥、接入点或付费路径。记录耗时、错误、实际输出尺寸/格式；不落盘签名 URL 和完整响应。

## 4. 看图、算数、出报告

- 有干净参照图时，执行器计算水印框内相对干净图的误差改善，以及框外再避开 20 像素带的 RGB 平均绝对差。输出先缩到干净图尺寸。指标会受到全图重绘、调色和缩放影响，只用于定位需要细看的样本，不能直接当作成功率或视觉评分。
- 人工查看**每张**输入与输出，并重点放大人物、原有文字、建筑边缘、细密纹理。记录可辨水印残留、非目标区域变化和需要指定区域的样本；对局部失真写具体位置，不用“看起来更好”代替证据。失败、未计时和未知状态都保留在报告里。
- 在本次运行目录写一份可选的 `report-notes.json`，格式参考[阶段 0 的说明](../samples/phase0/report-notes.json)：短结论、重点样本、目录价与免费额度说明。说明人工检查覆盖范围，不把未核对的细节写成通过。
- **每轮必须生成 HTML 报告**。报告包含样本来源与许可、输入图、干净参照、各模型直接/区域结果、请求状态、耗时、框外差、目录价估算和人工发现。报告图片是压缩预览；原始输出留在运行目录以便放大复核。

```bash
python3 tools/model_eval/report.py \
  --manifest samples/phase0/manifest.json \
  --evaluation /path/to/this-run/evaluation.json \
  --results-dir /path/to/this-run \
  --notes /path/to/this-run/report-notes.json \
  --output-dir reports/model-eval/YYYY-MM-DD-models
```

报告目录有 `index.html` 和 `assets/`，无需网络或到期的签名 URL。只分享报告目录时即可离线查看。目录价是估算，实际支出以后续账单为准。

## 5. 结论与接入门槛

先判断水印残留、原有人脸/文字/纹理是否被误改，再比较耗时与费用。报告要给出失败样本和适用边界；若关键区域有明显重绘，不能因平均指标更好就直接设置为默认模型。完成对照后，在项目状态或开发日志中写明候选模型是否进入产品接入，以及默认模型是否仍待产品链路验收。

本次已补的离线报告：[Seedream 5.0 对照报告](../reports/model-eval/2026-09-23-seedream-5/index.html)。
