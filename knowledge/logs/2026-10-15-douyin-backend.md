# 抖音普通图集后端

## 范围与结果

新增 `apps/server/internal/douyin`，沿用 XHS 的 client/service、内存元数据缓存、下载临时文件和完整 ZIP 交付方式，未修改 XHS 实现、前端或 Seedream 流程。HTTP 提供 parse、单图、archive，GitHub 会话保护与 XHS 一致；MCP 新增 parse_douyin_item、get_douyin_image、get_douyin_archive，复用同一个业务实例及其限额，异步任务沿用现有领取方式。

首阶段仅普通图集；视频、实况和未知类型返回 HTTP 422，MCP 任务返回相同安全错误消息。参数、响应和限额以 [Go API 说明](../../apps/server/README.md#抖音图集下载后端) 为唯一维护位置。

## 上游依据

2026-10-15 读取官方仓库源码 `473c90ff70c663cfb69310fff2b8d5192f200661`，`src/custom/internal.py` 标识 5.8 stable。核对 `src/application/main_server.py`、`src/models/{base,detail,share,response}.py`、`src/link/{extractor,requester}.py` 与 `src/extract/extractor.py`：share 响应的 URL 位于顶层；detail 返回规范化英文键，普通图集 downloads 为字符串数组；实况 downloads 为混合结构。未按 XHS 的中文字段或旧版 solo API 猜测实现。固定源码链接见 API 说明。

DOUYIN_API_URL 限 loopback IP origin，生产装配禁用该客户端的环境代理、Cookie jar 和重定向；只传校验后的单条链接或作品 ID，不传调用者 Cookie/proxy。媒体通过已有 media.Client 的公网 IP 拨号与重定向校验。没有真实媒体样本，因此采用明确记录的初始 `*.douyinpic.com` 域族策略，未知域拒绝；真实 host、重定向及图片格式验收留为部署前 TODO。

## 本地验证

使用本机已有 Go 1.27.2 工具链：

- `go test -race ./internal/douyin ./internal/config ./internal/server ./internal/mcpserver` 通过。覆盖长/短链接、DouK 请求/响应契约、类型/字段映射、CDN 拒绝、错误脱敏、取消、单图与 ZIP 原字节、失败 ZIP 不交付、缓存 TTL/容量淘汰、并发限额、输入 Cookie 拒绝、路由认证及 MCP 任务/文件交付。
- `go test -race ./internal/xhs ./internal/media` 回归通过。
- `go vet ./internal/douyin ./internal/config ./internal/server ./internal/mcpserver` 通过。
- `go build -o /private/tmp/watermark-douyin-server ./cmd/server` 通过，未在仓库提交构建产物。
- `git diff --check` 通过。

httptest 的本机端口监听需要在沙箱外执行；未进行生产部署、真实 DouK 调用或公网 MCP 客户端验收。Docker sibling 的 5555 loopback 绑定、固定镜像及 Web API 模式启动要求见 [部署说明](../../deploy/README.md)。
