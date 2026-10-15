# Grok Bot 正式业务工具接入

日期：2026-10-15。接续[兼容探针](2026-10-15-mcp-probe.md)，按用户要求推进完整业务接入，并保持架构、用户流程和实现的一致性。

## 实现

- 探针整理提交为 `1b5185c`，作为已部署、已验收的回滚节点。
- `internal/mcpserver` 提供五个业务提交工具及 get_task/get_task_result；协议和 Bearer 验证继续使用官方 Go SDK。诊断工具由 MCP_ENABLE_PROBES 控制，默认关闭。
- 有界任务表在请求之外执行，包含 requestId 去重、状态、错误、结果有效期和清理；查询最多等待 20 秒。网页与 MCP 共用 processing.Gate，小红书共用抽取后的 Parse/Image/Archive，原 HTTP 契约保持不变。
- 小图使用 ImageContent，小 ZIP 使用内嵌 resource；所有结果提供文本元数据与短期原文件下载链接，大于 8 MiB 时只返回文件信息并流式下载，凭据为 HMAC 单文件授权、5 分钟有效。上游 API Key、MCP 服务 Token 不进入工具结果。
- 编写仓库内可分发的 image-workbench Skill，按 writing-for-agents 分离操作规则与参数事实，经 skill-creator 校验器通过。

## 本地与公网验证

针对性 race 测试覆盖 mcpserver、server、xhs、watermark、processing、config；vet 和 Linux amd64 构建通过。覆盖七个正式工具、默认 Lite、Flash/区域参数、sourceJobId 串联、请求去重、查询取消不取消任务、容量与过期清理、共享处理槽位，以及内嵌 ZIP、大文件下载、签名和文件绑定。模拟上游测试不消耗模型调用。

云端通过 tccli/TAT 暂存、校验和构建后切换，保留原版本及环境配置。发布目录 `/opt/watermark-api/releases/mcp-business-20261015-617d6785`；源码包 SHA-256 `617d6785715c6afa992d7a0331fb07c62a4466b5b779a765603814efb354f81a`，服务器二进制 SHA-256 `2a8cf55127c162f27c89f876b6813e099d9834777949430c5cd16314b708aa97`。切换任务 `inv-u9wc9r09u3` 成功，服务 active、health 200、无凭据 MCP 401、网页登录认证未放开。

公网免费检查已通过：七个业务工具发现、异步提交/查询、相同 requestId 得到同一 jobId、内嵌 ZIP 完整性、短期下载字节与摘要一致。当前临时启用诊断工具以完成客户端长任务验收；尚不能据此标记真实模型或 Grok Bot 正式业务全部通过。

## 客户端与真实业务验收

免费异步客户端验收通过：Grok Bot 于 13:28 返回任务 `90ce4d98c4c35e85871b14c06b3952ac` 的结果，报告提交耗时 6.663 秒、六次原生 get_task(waitSeconds=20) 共等待 119.7 秒，无 -32001；同 requestId 重试取得同一 jobId。ZIP 经 get_task_result 内嵌 resource 进入宿主附件，未使用备用链接或显式 HTTP RPC。

附件通过桌面保存到本机后独立验证：434 字节，SHA-256 `62fef4500582a99d0333374addec1fed74ef867bdd679f2addf10e9ebd795628`，包含 image.png、README.txt，ZIP 完整性检查通过。这证明长任务与原生 ZIP 交付链路，不能替代真实业务验收。

Grok Bot 已通过实际保存工具将 image-workbench 安装为私有技能，标识 `image-workbench`，路径 `/home/box/agent-data/workflows/image-workbench/SKILL.md`，客户端报告读回名称、描述及正文与附件一致，聊天中出现可打开的技能入口。

宿主工具目录仍只列旧四项探针，原生 CallDynamicTool 能调用新增工具；重启及按原命令重新添加同名连接器后仍未刷新。这是尚未解决的客户端发现问题，不将可调用等同于完整发现成功。

独立对话 Cloud Lighthouse Steward 复核目录仍为四项；同一 stdio 包装启动的临时会话仅执行 initialize/tools/list，收到十二项及各自完整 inputSchema，问题因此定位到宿主目录发现侧，未通过改写服务协议规避。

真实小红书解析成功（任务 `6afde03f2f3d5ca1850f634d9b5e2626`，两张图片），首图下载成功（任务 `a133bfd4d705a64360baef1c3cca6f1d`，原文件 220012 字节）。客户端报告 JPEG ImageContent 落盘被重编码，无法匹配服务端摘要；未将其算作原文件交付通过。图集任务 `997c9f9c209fed4e34347aeec4ca40d9` 成功，506187 字节；但客户端最终澄清原生领取为空，额外直连领取的 ZIP 不计入原生验收通过。

针对实际缺口，get_task_result 改为所有文件提供短期下载链接，保留原有协议内容，并以 TextContent 同时返回文件元数据，让忽略 structuredContent 的宿主也能取得链接及校验值。补充小图无 Bearer 下载原字节、文本与结构化元数据一致的测试，mcpserver race 测试通过。Skill 相应要求图片下载原文件并核对摘要，校验器通过。

修复已通过 tccli/TAT 构建并切换至 `/opt/watermark-api/releases/mcp-business-files-20261015-7ea497ee`，源码包 SHA-256 `7ea497eeb716d1400ebc984bfe6734cf1e0c93e2f01cfb2c585c3d4696f26b14`，二进制 SHA-256 `1712176da28d78726d6b31771ec9ead9bee38c31a31279c747d1767071111d17`。发布任务 `inv-k9wctpgjj0` 成功，原认证和健康检查正常。公网免费检查确认文本元数据及短期下载原字节通过。当前正在让 Grok Bot 更新技能并重新执行免费业务交付验收，旧任务因重启已失效。

修复后免费原生业务验收通过：解析 `d1c90035a775b4cdea7b87239f85d755`、首图 `4759ab65eb41faf01af1434f3b58a557`、图集 `7e651b156805fd39bd54ad4658aea1ff` 均 succeeded。Grok Bot 使用 CallDynamicTool 领取 downloadUrl，再下载并交付原文件；未通过 shell/HTTP RPC 调用业务。JPEG 为 220012 字节，SHA-256 `e2cd18118a27712aaabee7c8617abb1e50fed8483924f92702f6a2653a5e622f`；ZIP 为 506187 字节，SHA-256 `75dcaf86765edc85c954f6ba4d7aa6dd622c07629ffdeb9a470e889bcddac9ee`。桌面保存 ZIP 后独立核对整包摘要、两成员字节数及摘要、ZIP 完整性均通过。

自动审批此前要求具体付费授权；用户现已明确授权合成图最多三次（Lite 全图、Flash 全图、Lite 区域各一次），失败不自动重试。三项已各提交一次并全部成功，Grok Bot 原生查询/领取后交付三张结果及三图 ZIP。服务端状态、实际模型与原文件已独立核对；桌面保存三图 ZIP 后，整包摘要及三成员与服务器结果逐字节摘要一致。

| 验收 | jobId | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| Lite 全图 | 0b98bbe41989703faf8fc5af5a918547 | 1902298 | f154da5178024c97509ca0365ffa443c5f9d1f8d22e5e41f80f92620a29f8efa |
| Flash 全图 | 2cc6f0a78907e92c0fbaa8a5ebc6a749 | 2309662 | 86af6e443419c1bff26462c99c7630f49c290c0971058c574321852045dca89e |
| Lite 区域 | 2948ba20f9fc8fcee9ec686044277b7c | 1859506 | 2676f00000a1ef83d17cadb8f9ddf9dbe0821969873a4c7ab054d72201c2c7da |

三图为 2496×1664 PNG；目视合成样本的 DEMO 已消除，不据此承诺真实照片效果或框外像素完全不变。客户端所报耗时未形成可靠的端到端计时，不记录为模型延迟结论。验收 ZIP 5996399 字节，SHA-256 `76b3f1633cab3a6c7f9c93760c42f7f47b46154f98a9af0fb04bd168aa012238`。

免费放大串联任务 `0d4b125dae84c1cd3719ca6388491bf6` 使用 Lite 结果 sourceJobId 被接受，但上游结果下载失败。独立免费诊断确认 Gradio 4.36.1 返回的 FileData.url 含错误 `/c/file=` 前缀（404），同一 FileData.path 的标准 `/file=` 地址为 200，可取得生成结果，无需重复计算。适配器改为优先根据 path 构造标准文件地址，保留仅 URL 的响应支持；已复现响应的回归测试及 upscale/mcpserver/server race 测试通过。正在构建发布并关闭诊断工具，再验收免费放大链路。


放大修复及诊断关闭已发布：`/opt/watermark-api/releases/mcp-business-20261015-80e0ce10`，源码包 SHA-256 `80e0ce108e374a837ae8b2fc88ab55ae519ae99d206a1db79024b05e9d34d843`，二进制 SHA-256 `d424785d2a84065a1897f8a8c1a3aeb5e20da92a4f6d351d44e477f6f494e294`。发布任务 `inv-q9weip06tu` 成功，健康及认证检查通过，MCP_ENABLE_PROBES=false；公网 tools/list 恰好七项，无 probe 工具。upscale/mcpserver/server 的 vet 通过。当前在以同一命令和凭据迁移正式连接器名称，随后进行修复后的免费放大复验；未追加付费调用。


## 收尾结果

- 正式连接器迁移为 `image-workbench` / `user-image-workbench`，保持同一 stdio 命令、端点和凭据；新目录实际发现恰好七个工具及完整 inputSchema，旧 `personal-mcp` 注册已移除，脚本 0755、认证文件 0600 保留。Skill 已更新连接器引用并读回确认。14:48 最后一次只读核对再次确认七工具、旧注册移除和文件领取规则均符合。
- 修复后的免费完整链路通过：解析 `e3f69c39c5511df9dbd2db5f55f5741d` → 首图 `373a98adcc06a2fe18ddd405b8728856` → 放大 `f0d91fe0ca575e6f38be713acc6cfc06`；放大通过 sourceJobId 引用首图，每步只提交一次，无新增去水印调用。Grok Bot 已交付源图及放大原文件。
- 源图为 1910×2546 JPEG、220012 字节；放大为 3820×5092 WebP、246234 字节，SHA-256 `87c36c561911771590cf4e700d511d06da4de9ead860e6bef65bc399ac0fef5d`。独立读取已成功任务后下载原文件，核对摘要、字节数及 WebP 实际尺寸均通过。
- 当前部署源码包与工作区全部打包运行文件逐一比较一致；诊断工具已关闭，网页登录认证未放开。放大路径修复已独立提交 `d52ecb8`，正式 MCP 接入代码与知识记录随后整理提交。

本轮业务接入完成：Lite/Flash/区域去水印、放大、小红书解析/单图/图集、异步查询、原文件交付、任务串联及私有 Skill 均有实际验收依据。保留个人单实例边界：任务完成后保留 30 分钟，服务重启失效；签名链接有效 5 分钟，可为同一有效任务重新领取。本次样本不代表长期稳定性或所有图片上的模型效果，未新增这些专项结论。
