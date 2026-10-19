# 高清增强方案调研

日期：2026-10-16。目标：判断 Real-ESRGAN 之外是否已有更适合“变高清”的方案。本轮只核对官方文档、代码、模型卡和论文，没有下载模型、运行图像对照或调用付费服务；以下质量判断是候选筛选，不是本项目实测排名。未修改业务代码。

## 开源候选

| 候选 | 已确认的时间与能力 | 部署与许可 | 本项目判断 |
| --- | --- | --- | --- |
| SeedVR2 | 2025-06 发布，2026-01 获 ICLR 2026 接收；一步扩散修复，3B/7B。官方认可的 ComfyUI 集成明确支持图片与视频 | 上游和 3B 模型卡为 Apache-2.0。集成提供量化、分块与卸载；其硬件建议包含 8GB 以下搭配 GGUF/BlockSwap/VAE tiling、12–16GB FP8、24GB+ FP16，实际取决于分辨率和设置 | 优先纳入自然照片效果对照；生成纹理更强，同时须检查过锐化和细节改变。不能仅凭论文将其定为全面优于旧模型 |
| VOSR 2.0 | 2026-08-22 发布，一步 1.4B DiT，纯视觉条件，官方强调细结构与文字可读性；明确面向单张图片 | 仓库 Apache-2.0；提供图片/目录 CLI、DiT 与 VAE tiling。本次没有确认最低显存及具体权重和依赖资产的完整许可组合 | 很新的研究候选，值得在照片、截图、文字图上对照；官方“更保真”主张不能替代本项目实测 |
| FlashVSR / FlashVSR+ | FlashVSR 于 2025-10 发布、11 月更新 v1.1；FlashVSR+ 论文 2026-10-13 刚提交 | 官方仓库均标为 Apache-2.0。Plus 官方报告 RTX 4090 24GB 可做不分空间块的 4K 视频推理；发布管线要求 Linux/NVIDIA CUDA | 主要解决视频超分。未确认官方单张图片产品入口，不作为当前图片增强的直接替代首选；视频性能不能套用到图片 |
| SUPIR | CVPR 2024 的照片修复方案，基于 SDXL，提供高保真与质量优先参数 | 官方低显存示例仍分别列 diffusion 12GB、LLaVA 16GB；README 明确非商业使用，商业需事先书面许可 | 可作历史效果参考，但不是“最新首选”；依赖重，且有明确商业使用限制 |

SeedVR2 的日期、架构、上游限制与许可见 [ByteDance 官方仓库](https://github.com/ByteDance-Seed/SeedVR)；3B 权重许可见 [官方模型卡](https://huggingface.co/ByteDance-Seed/SeedVR2-3B)。图片支持、低显存配置与平台说明见 [官方认可的 Numz 集成](https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler)。上游 H100-80GB 示例是 100 帧视频推理要求，不能解释为单张图片最低硬件门槛。量化集成建议同样不是指定尺寸、耗时或质量的承诺。

VOSR 2.0 的发布日期、图片推理、文字方向与分块参数见 [作者仓库](https://github.com/cswry/VOSR)，许可见 [LICENSE](https://github.com/cswry/VOSR/blob/main/LICENSE)。[单步推理代码](https://github.com/cswry/VOSR/blob/main/inference_vosr_onestep.py)接收图片、控制倍率并写出 PNG；虽然代码包含 CPU fallback，本轮没有确认 CPU 路径可用性与实用耗时，不据此推荐无 GPU 部署。

FlashVSR 的发布日期与视频指标见 [作者仓库](https://github.com/OpenImagingLab/FlashVSR)；Plus 的要求见 [作者仓库](https://github.com/OpenImagingLab/FlashVSR_Plus)，具体论文提交时间见 [arXiv](https://arxiv.org/abs/2610.17552)。SUPIR 的模型、参数、硬件示例和非商业声明见 [作者仓库](https://github.com/Fanghua-Yu/SUPIR)。

## 保真与“高清”的边界

生成式修复可以让纹理更丰富，但“看起来更清晰”和“恢复真实信息”是不同指标。SeedVR2 官方明确列出重度退化时的失败、轻度退化输入的过度细节生成与过锐化；SUPIR 官方也明确区分视觉质量优先和保真优先的取舍。应将自然照片细节、人脸、细文字/Logo、线条与颜色分别纳入对照，避免只验收尺寸翻倍。[SeedVR2 限制](https://github.com/ByteDance-Seed/SeedVR#-notice) · [SUPIR 参数说明](https://github.com/Fanghua-Yu/SUPIR#empirical-hyperparameters-settings)

补充筛选过 InvSR（CVPR 2025，支持 1–5 步图片超分），但其 [S-Lab License](https://github.com/zsyOAOA/InvSR/blob/master/LICENSE)明示非商业用途，商业需要联系贡献者，因此不列为优先生产候选；该项目也没有在本轮资料中确认最低显存。[作者仓库](https://github.com/zsyOAOA/InvSR)

## 当前结论

已有明显更新的可测候选：自然照片先对照 SeedVR2；若更重视文字、截图与细结构，加入 VOSR 2.0。尚不能仅从仓库更新日期判断哪一个在本项目图片上最好。此次结论止于文档研究，最终替换须结合实际图片、耗时、失败率与部署成本再定。

## 商业 API 路线与项目接入评估（主代理补充）

核对日期：2026-10-16。以下价格是公开目录价，不含可能的上传、存储等附加成本；未调用付费推理接口，未核对账号开通状态及账单。

### 火山引擎 AI MediaKit 图像画质增强

官方开发指南最近更新于 2026-09-11，浏览器现场读取核实。此服务有独立 AI MediaKit API Key，不能假定现有方舟 Seedream Key 可直接复用。同步入口为 `POST https://mediakit.cn-beijing.volces.com/api/v1/tools-sync/enhance-image`，返回结果图片 URL。支持公网 URL、`mediakit://` 上传和 `tos://` 输入；PNG/JPEG/WebP，单图上限 10 MB。[开发指南](https://docs.volcengine.com/docs/Intelligentprocessing/Imageimagequalityenhancement?lang=zh)

| 版本 | 每张目录价 | 输入尺寸限制 | 适合评估的用途 |
| --- | --- | --- | --- |
| standard | ¥0.006 | 短边 16–1440、长边 16–2160 | 常规去噪、去压缩痕迹和清晰度增强 |
| professional | ¥0.036 | 短边至少 256、长边最多 2048 | 更细致的纹理恢复 |
| max | ¥0.24 | 短边至少 64、长边最多 6240，长短边比最多 32 | 较大图片的生成式修复 |

价格已通过[图像工具计费](https://docs.volcengine.com/docs/Intelligentprocessing/image-tool-billing?lang=zh)二次核对：按成功次数计费，三档为 6/36/240 元每千次；100 张分别为 ¥0.60/¥3.60/¥24.00。

指南支持 `multiple=1`，可作为原尺寸增强的候选；实际画质和输出尺寸尚未调用验证。professional/max 提供 `generative_enhance_mode=fidelity_first`，是贴近本项目保留人物、文字、构图目标的候选参数，不代表像素不变保证。文档 default 倍率仍是 2，应显式指定目标。max 输出长边上限 10240，指南建议目标控制在 8000×8000 以内以减少超时。[参数与限制](https://docs.volcengine.com/docs/Intelligentprocessing/Imageimagequalityenhancement?lang=zh)

**直接影响本项目的限制：**已有验收图片为 1910×2546，professional 和 standard 均不能直接接收它（见[本项目验收记录](2026-10-15-mcp-business.md)）。不应先缩到 2048 再宣称无损升级；如做这种实验，应单独标记预处理，与原图直接输入的候选区别记录。因此更合理的试验是：符合尺寸的低清样本测 professional，大图测 max；比较同图候选时统一符合各自条件或明确列出差异。

### fal 托管 SeedVR2 图片接口

已核实独立图片端点 `fal-ai/seedvr/upscale/image`，支持倍率或目标分辨率、seed、noise_scale、PNG/JPG/WebP，输入可用 URL 或 Base64 data URI。公开价格为 **$0.001/MP**。本轮页面未明确写清计费采用输入还是输出像素、如何取整，因此不承诺每图确切金额。[API 文档](https://fal.ai/models/fal-ai/seedvr/upscale/image/api) · [价格页](https://fal.ai/models/fal-ai/seedvr/upscale/image)

工程判断：对现有 Go 服务而言，这是较省事的现代开源模型试验路径，无需先自建 GPU；需要新增供应商凭据、出站连通性和结果下载适配。模型作者与托管供应商是不同主体，不能将它称为字节官方商业 API。noise_scale 的保真调优仍需同图实验，论文/视频成绩不能代替本产品图片效果。

### Topaz 托管图片接口

fal 提供 Topaz 合作伙伴接口，区分 Precision 和 Generative 模型。High Fidelity V2、Text Refine 等可作保真方向对照；Redefine 等有生成细节参数，不能仅以锐度认定更好。API 默认打开人脸增强，保真人像实验建议显式关闭，以便单独评价超分效果。输出支持 PNG/JPEG。[模型与参数](https://fal.ai/models/fal-ai/topaz/upscale/image/api)

公开页面显示，单张输出不超过 24 MP 的价格为 **$0.08**，48 MP 为 $0.16、96 MP 为 $0.32，更大尺寸另计。不同模型最终账单需在执行前确认。[公开报价](https://fal.ai/models/fal-ai/topaz/upscale/image)

工程判断：可作为商业保真基准，第一轮无需同时测试所有 Topaz 模型。

## 对当前项目的建议与下一步

本节是基于文档与现有架构的选型判断，尚未选定或替换生产模型。

1. **近期先比较托管 API。**优先 SeedVR2 图片 API，与火山 professional/max 的 `fidelity_first` 做同图对照。前者验证现代开源模型的收益，后者验证国内服务与原尺寸增强的适配性；Topaz High Fidelity V2 可补一组商业保真基准。
2. **需要自主部署时再评 VOSR 2.0。**它是本轮发现的新图片专用候选，值得关注文字与细结构；没有现有机器 GPU 配置及真实推理数据，不能把模型参数量直接转换为可部署结论。
3. **产品入口按目标命名。**建议“高清增强”，尺寸属于独立输出选项；不要将超分倍率或文件变大当成效果验收。是否增加原尺寸模式，应在模型试验后另做产品决定。
4. **沿用 HTTP/MCP 共用业务实现。**若后续落地，在 `upscale.Service.Enhance` 所在业务层替换上游适配，HTTP 与 MCP 保持同等参数、校验和结果语义；本次仅调研，没有实现变更。现状见[架构契约](../contracts/architecture.md)。

建议首轮用 5 张有使用权的样本：低清人像、风景、中文文字/截图、商品细纹理、去水印结果；现有 Real-ESRGAN 同轮作为基线。各候选同图同目标尺寸，首轮每张每模型只跑一次，记录模型版本、实际尺寸、耗时、失败、费用和原文件。单独评估人物身份/文字正确性、清晰度、伪纹理与颜色变化；同时做输出缩回原尺寸的观察，避免把“大”误认为“清楚”。原尺寸增强另组，不与两倍输出混为一谈。参照[现有评测流程](../model-evaluation.md)生成 HTML 对照，但不照搬其水印框指标。

**本轮证据边界：**已完成官方文档、许可证及接口研究；没有下载权重、部署 GPU、提交付费任务、上传用户图片或运行画质实测。不能得出任何候选在本项目样本上已胜过 Real-ESRGAN 的结论。
