# 2026-09-23 · 阶段 0：Ark CLI 与公开文档核对

目标：推进 [Issue #1](https://github.com/sousouliao/watermark-remover/issues/1) 中的模型 API 核对。

## 已完成

- 按[方舟安装指南](https://lf3-static.bytednsdoc.com/obj/eden-cn/psjryh/ljhwZthlaukjlkulzlp/intro/volc.md)全局安装 `@volcengine/ark-cli`；`arkcli --version` 返回 `1.0.34`。SSO 登录成功，`arkcli auth status` 显示已登录并配置 cn-beijing 账号范围 profile；`arkcli doctor` 确认安装、网络和凭据正常。使用 `arkcli +connect --path /Users/asherliao/.agents/skills --keep-conflicting` 把官方 Skill 连接到本机 Codex skills 目录，保留已有 Skill。
- [官方模型列表](https://ark.volcengine.com/region:cn-beijing/docs/ark/model-list?lang=zh)把 `doubao-seedream-5-0-260128` 列为 Lite，并注明同时支持 `doubao-seedream-5-0-lite-260128`；Flash 的 ID 为 `doubao-seedream-5-0-flash-260915`。这是文档支持关系，账号可调用性仍待验证。
- [公开价格页](https://ark.volcengine.com/region:cn-beijing/docs/ark/model-pricing?lang=zh)列出 Lite 为 ¥0.22/输出图，Flash 为 ¥0.12/输出图，输入图均免费；实际结算以账号和下单结果为准。
- [Flash 教程](https://ark.volcengine.com/region:cn-beijing/docs/ark/seedream-5-0-pro)给出 `POST /api/v3/images/generations` 的图像编辑示例：请求包含 `model`、`prompt`、`image`、`size`、`output_format`、`watermark`，输入图可为 URL 或 `data:image/...;base64,...`，响应可选择 `url` 或 `b64_json`。文档说明输入图不超过 30 MB，输出 URL 保留 24 小时。
- [交互编辑指南](https://ark.volcengine.com/region:cn-beijing/docs/ark/seedream-5-0-pro-editing-guide?lang=zh)说明 Flash 可用标记图，或在提示词中使用归一化到 0–999 的 `<point>` / `<bbox>` 坐标定位。Lite 的区域指示方式仍需实测。
- 开通 Flash 前，当前账号的 `arkcli pricing models --model doubao-seedream-5-0` 返回 Lite 基础服务 `Available`，图生图 ¥0.22/输出图；`--model doubao-seedream-5-0-flash` 返回 Flash 基础服务 `Unavailable`，图生图 ¥0.12/输出图。CLI 当时显示 Lite 有 50 张未消耗的免费资源包，账号尚无已配置图像接入点。
- `arkcli models get` 确认 Lite 与 Flash 都支持 `model`、`prompt`、`image`、`size`、`response_format`、`output_format` 和 `watermark` 等字段。Lite 可选组图，Flash 支持交互编辑；两者的输出尺寸范围不同，接入前需要分别验证。
- 经用户授权，开通 Flash 的 `base` 服务，并创建两个按量接入点：Lite `ep-20260923164857-dr5rx`、Flash `ep-20260923164909-dxszf`。两者的接入点状态均为 `Running`；未修改 profile 默认图像接入点。Flash 账号计费状态复核为 `Available`。
- 用临时自制的 1024×1024 标记图试调用 Lite。以模型 ID 直接调用 `arkcli +gen` 未发出请求：当前 platform profile 要求 `ep-...`。改用 Lite 接入点后，`POST /images/generations` 返回图片 URL，CLI 下载为 2048×2048 PNG。相同提示词、输入图和 `size=2K` 下，未显式指定 `watermark` 时结果右下角新增“AI生成”；显式 `--watermark=false` 后，`DEMO` 被移除且没有新增该标识。结果只验证调用链，临时测试图不能代替真实图片效果对照。
- 用 Flash 接入点和同一输入首次尝试图像编辑时，调用被账号“安心体验模式”的模型用量限额拦截，未得到输出图。按[官方说明](https://docs.volcengine.com/docs/undefined/1465347?lang=zh)，关闭安心体验模式是账号范围操作，且关闭后无法重新开启；首次失败时未调整该设置。
- 用户随后自行关闭安心体验模式。使用 Flash 接入点、同一测试图和提示词，显式传入 `--watermark=false` 后，`POST /images/generations` 成功返回图片 URL，CLI 下载为 2048×2048 PNG。目视检查：`DEMO` 被移除，没有新增“AI生成”标识。两模型的直接编辑调用链已验证，但临时合成图不构成真实样本的保真结论。
- 同一张合成图上，对 Lite、Flash 分别用 `<bbox>560 790 880 910</bbox>` 提示词试调用区域编辑，均成功返回 2048×2048 PNG，框内 `DEMO` 被移除。该结果只证明两款模型在当前接入点可接受这一定位写法。
- 从 Wikimedia Commons 中筛选许可元数据为 CC0 或 Public domain 的真实照片，选取 20 张不同照片，覆盖城市、建筑、树林、人物、室内、石材纹理、街牌和花卉。每张裁为 1024×1024，保留未加标记的干净参考图，再分别合成角落小字、半透明文字、中央文字或大块标识，共四类，每类五张。照片与来源许可清单保存在 [`samples/phase0/`](../../samples/phase0/README.md)。样本是本次评测所造的覆盖图，不能代表任意第三方真实水印。

## 真实照片对照

- 20 张样本 × Lite/Flash × 直接/区域两种提示，共 80 次图像编辑，全部成功并下载为 2048×2048 PNG；未出现 API 失败或超时。首个真实样本调用未独立计时，其余 79 次的状态和耗时保存在 [`evaluation.json`](../../samples/phase0/evaluation.json)。响应中的签名图片 URL 有效期有限，完整响应和生成图留在本机 `/private/tmp/watermark-remover-phase0/results/`，不提交到仓库。
- 所有请求使用 `--modality image --input @<NN-marked.jpg> --size 2K --output-format png --response-format url --watermark=false`，模型参数分别是 Lite/Flash 的上述两个 `ep-...`。CLI 将输入图转成数据 URL，调用 `POST /api/v3/images/generations`。直接提示词要求只移除后加的 `© DEMO`、`SAMPLE`、`BRAND` 或 `PREVIEW`；区域提示词在同一句中附加清单里的 0–999 坐标 `<bbox>x1 y1 x2 y2</bbox>`，并要求区域外不变。`evaluation.json` 保存准确提示词模板和首个请求的例外文案；样本清单保存输入 SHA-256 与区域坐标。可复现的 CLI 命令形式：

  ```bash
  arkcli +gen --model ep-20260923164909-dxszf --modality image \
    --input @samples/phase0/19-marked.jpg --size 2K \
    --output-format png --response-format url --watermark=false \
    --no-open --save-to /tmp/seedream-result --format json \
    '请仅移除 <bbox>205 341 795 644</bbox> 区域内后加的 BRAND 水印文字或标识，恢复其下的原照片纹理。区域外保持不变；保留原照片中的人物、物体和原有文字，不要添加新元素或新文字。'
  ```

- 中位请求耗时：Lite 直接 34.48 秒（19 次已计时）、区域 34.94 秒；Flash 直接 27.53 秒、区域 27.24 秒（各 20 次）。这组数据是在同一账号、两路并发下采得，只适合本次对照，不等于服务级延迟保证。
- 将输出缩回 1024×1024 后，计算水印框外（再避开周围 20 像素）的 RGB 平均绝对差。中位差值依次为 Lite 直接 13.11、Lite 区域 12.78、Flash 直接 10.23、Flash 区域 7.78（0–255 像素值）；区域提示比直接提示的框外差值更低：Lite 9/20 张、Flash 15/20 张。生成模型会重绘、调色和缩放整图，像素差不能单独判定真实视觉保真，以上只作辅助指标。
- 四组对照拼图目视未见可辨的合成水印残留；大块标识、人物脸部、街牌原有文字和复杂纹理都应同时检查非目标改动。样本 02、03、04、08、14 使用 Flash 区域提示时，框外差值比其直接提示明显降低，建议在这类遮挡上优先给区域。没有样本表现为“必须给区域才能去掉文字”。样本 19 的花心在 Flash 的两种结果中明显变平滑，区域提示未消除这一局部重绘问题；Lite 保留更多可见颗粒细节。即使提示“区域外不变”，输出也可能改动框外内容，不能把 `<bbox>` 当作硬蒙版。
- 本次 40 次 Lite + 40 次 Flash 真实样本输出，按当前目录价合计上限约 ¥13.60。批量前 Lite 免费资源包剩余 47 张，足以覆盖其 40 次；Flash 查询不到免费资源包，40 次按 ¥0.12/张估算约 ¥4.80。评测后 Lite 余额快照在 `2026-09-23T17:35:47+08:00` 只同步到已用 31/50，账单尚未出齐，因此 ¥4.80 是预估，不是实际结算金额。

## 结论与后续

- Issue #1 的阶段 0 完成条件已满足：两模型均可调用，20 张有使用权照片的四路对照和可复现请求格式已记录。Flash 在这批样本上更快、价格更低，区域模式的框外像素差通常更小；但样本 19 表明不能据此断定其局部细节总是更好。默认模型留到阶段 3 的产品链路验收后决定。
- 下一步按 [Issue #2](https://github.com/sousouliao/watermark-remover/issues/2) 重构后端调用链，让应用后端持有方舟凭证、支持用户明确选择 Lite 或 Flash，并处理上游失败。仓库目前没有改动产品代码。

## 2026-09-24 补充

将本次评测整理为[可复用流程](../model-evaluation.md)，并补充[离线 HTML 对照报告](../../reports/model-eval/2026-09-23-seedream-5/index.html)。报告中的图片是压缩预览，可逐张切换 Lite/Flash 与直接/区域结果；原始 2K 输出仍以本地评测目录为准。
