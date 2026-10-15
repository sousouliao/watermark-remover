# Grok Bot 图片工作台

远程入口为 `/api/mcp`，使用官方 Go SDK 的 Streamable HTTP 与独立 Bearer 认证。业务复用 HTTP 的去水印、放大、小红书和抖音服务；Grok Bot 通过短调用提交、查询、领取结果，避开客户端约 60 秒的单次调用限制。

## 配置与部署

保留原 GitHub、模型与解析器配置，新增：

```text
MCP_TOKEN_SHA256=<专用 Token 的 SHA-256 十六进制摘要>
MCP_PUBLIC_URL=https://43.138.214.93
MCP_ENABLE_PROBES=false
```

Token 摘要为空时关闭 MCP；非法摘要或配置导致启动失败。`MCP_PUBLIC_URL` 必须为外部实际可访问的 HTTP(S) origin，用于生成文件下载链接；生产使用 HTTPS。沿用现有 Nginx `/api/` 代理和 systemd 发布方式，无需新增端口。

已有专用 Token 时继续使用。首次配置可在仓库根生成原文文件，仅输出摘要：

```sh
python3 - <<'PY'
import hashlib, os, secrets
from pathlib import Path
folder = Path('.local/mcp-probe')
folder.mkdir(parents=True, exist_ok=True, mode=0o700)
token = secrets.token_urlsafe(32)
fd = os.open(folder / 'token', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(token)
print('MCP_TOKEN_SHA256=' + hashlib.sha256(token.encode()).hexdigest())
PY
```

已有文件时命令停止，避免覆盖。原文经 Grok Bot 安全凭据卡交接，不写进普通聊天、Skill、URL 或诊断输出。服务端只保存摘要，使用 SDK Bearer 中间件和恒定时间比较；不发布 OAuth discovery，网页 GitHub 登录保持独立。轮换摘要并重启后旧 Token 失效。

## Grok Bot 连接与 Skill

已验证的客户端方式为其云端电脑 stdio → `mcp-remote 0.15.1` → `https://43.138.214.93/api/mcp`，使用安全卡保存的凭据。认证文件权限为 0600。当前客户端安全卡到远程 headers 的直接注入尚未验证，现有桥接可复用。

正式连接器为 `image-workbench`（命名空间 `user-image-workbench`），已部署版本包含七个业务工具；本次图片/视频对齐版本增加抖音解析、单图、ZIP、视频及小红书视频工具，部署后应发现十二个工具（新增工具尚未做公网客户端验收）。此前 `personal-mcp` 的宿主目录停留在旧探针，重启及同名重新添加无效；按同一 stdio 命令迁移正式名称后目录恢复，旧注册已移除，脚本和凭据沿用。升级后核对实际工具目录及 Schema，不能仅以“connected”判定发现成功。将仓库内的 [image-workbench Skill](../../integrations/grok-bot/image-workbench/SKILL.md) 保存到 Grok Bot 私有技能库，依照其步骤处理自然语言请求。Skill 不包含凭据和重复的参数 Schema。

## 工具与流程

| 工具 | 作用 |
| --- | --- |
| `remove_watermark` | 提交 Lite/Flash 全图或区域去水印，默认 Lite/direct |
| `upscale_image` | 按用户要求提交图片放大 |
| `parse_xhs_note` | 提交一条公开图文或视频笔记解析 |
| `get_xhs_image` | 提交解析结果中的单图下载 |
| `get_xhs_archive` | 提交图集 ZIP 下载 |
| `get_xhs_video` | 下载小红书视频 MP4，不传 index |
| `parse_douyin_item` | 提交一条公开抖音普通图集或视频；实况仍不支持 |
| `get_douyin_image` | 下载抖音解析结果单图，index 从 1 开始 |
| `get_douyin_archive` | 下载抖音图集 ZIP，不传 index |
| `get_douyin_video` | 下载抖音视频 MP4，不传 index |
| `get_task` | 查询任务；可等待最多 20 秒，及时返回当前状态 |
| `get_task_result` | 领取成功任务的文件与校验信息 |

十个提交工具立即返回 jobId。状态为 pending、running、succeeded 或 failed；失败包含可读 message。每个新操作提供一次 requestId，相同 ID 与相同参数在结果保留期内返回同一任务；不同参数复用 ID 会被拒绝。请求断开不会取消已接受的处理，不自动切换模型或重复付费调用。

图片来自聊天附件的完整 data URL 文件，用 `$file:` 注入字符串参数；服务端不能读取 Bot 的本地路径。后续操作可通过 sourceJobId 直接引用已成功的图片任务，无需下载后再上传。小红书解析成功的 output.note 中包含 resultId、笔记信息、mediaType 和 imageCount；图像序号从 1 开始，原始媒体 URL 不返回客户端。抖音解析位于 `output.douyin`，包含 `resultId/item/mediaType/imageCount/expiresAt`，后续下载仅使用该 resultId。输入 text、类型判断、缓存过期、下载限额和错误消息均由 HTTP/MCP 共享的 douyin 服务处理。

最终文件通过 `get_task_result` 交付：不超过 8 MiB 的图片为 ImageContent，ZIP/视频为内嵌二进制 resource；所有文件同时提供短期原文件下载 URL。超过 8 MiB 时仅返回文件元数据及下载链接，避免大段 Base64 扩大 MCP 内存开销。链接只授权一个结果文件、5 分钟过期，不需要附加 MCP Token；可在任务有效期内重新领取链接。Grok Bot 曾将 JPEG ImageContent 落盘重编码，图片交付因此使用下载链接取得原字节，ImageContent 用于预览。校验文件字节数和 SHA-256 后再作为聊天附件交付。

## 生命周期与限额

任务、请求去重信息与结果保留到完成后 30 分钟；服务重启后失效。临时文件使用私有目录，过期定时清理，关闭时取消在途任务并清理目录。任务数、在途数和总结果大小均有界，具体常量集中在 [tasks.go](internal/mcpserver/tasks.go)。当前个人单实例不提供持久队列或数据库。

网页与 MCP 共用一个图像处理槽位；网页繁忙时仍返回 503，MCP 在有界任务中等待。小红书和抖音分别共用各自 HTTP 服务的解析和下载限额。现有原图 30 MiB、图集和单视频 150 MiB 等业务限制继续由原服务执行。

## 验证与诊断

针对性测试覆盖异步生命周期、重复提交只执行一次、任务串联、过期清理、共享并发、十二个工具以及内嵌/短期下载授权：

```sh
cd apps/server
go test -race ./internal/mcpserver ./internal/server ./internal/processing ./internal/xhs ./internal/watermark ./internal/config
go vet ./internal/mcpserver ./internal/server ./internal/processing ./internal/xhs ./internal/watermark ./internal/config
```

`MCP_ENABLE_PROBES=true` 临时加入免费诊断工具；`probe_job` 可创建有延迟的 ZIP 任务，通过正式查询与领取工具验证长耗时兼容性。验收后关闭诊断工具。历史探针和客户端限制见[首轮实测](../../knowledge/logs/2026-10-15-mcp-probe.md)，正式接入与验收结果见[业务记录](../../knowledge/logs/2026-10-15-mcp-business.md)。日志仅记录方法、状态和耗时，不包含认证头、图片正文或完整参数。
