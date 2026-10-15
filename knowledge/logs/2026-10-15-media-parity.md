# 小红书与抖音图片/视频能力对齐

## 结果

检查发现两平台适配层都明确拒绝视频，抖音只有后端入口。本轮补齐普通视频解析、原文件下载，保留单图和图集 ZIP；实况不在本轮范围。用户指定真实平台验收由其后续执行，本轮未部署、未操作云端或 Bot 私有技能库。

## 实现边界

- 上游各自适配：XHS 视频 `下载地址` 是单元素数组；DouK 5.8 视频 `downloads` 是字符串，图集是数组。原始来源保持私有，HTTP/MCP 共享解析结果和限额。
- `media/video.go` 共用受限公网下载、MP4 文件头检查、实际字节限额、临时文件和 HTTP Range 交付。单视频 150 MiB/5 分钟；图片仍为 30 MiB/25 秒。完整文件取得后才交付，错误不发送部分视频。
- MCP 新增 get_xhs_video/get_douyin_video，图片、视频和 ZIP 共用文件保存及 SHA-256 计算。视频通过二进制 resource 或短期下载链接交付，不能作为图片处理 sourceJobId。
- 网页统一 MediaParserApp 和媒体类型，自动识别两平台，图片保留预览、单张及 ZIP，视频按需加载预览并提供下载。下载后缀依实际 MIME，修复固定 jpg 后缀；单张失败显示浮层提示。
- 抖音图片仍限 `*.douyinpic.com`，视频新增 `*.douyinvod.com`；小红书沿用 `*.xhscdn.com`。这些限制和平台访问条件是否覆盖用户现场样本，留待真实链接验收。

## 验证

- `go test -race ./internal/xhs ./internal/douyin ./internal/media ./internal/server ./internal/mcpserver` 通过，覆盖现有图片/ZIP 回归、两平台视频解析和原字节 HTTP 下载、Range、认证、类型隔离、失效、无效文件头/截断、超过旧图片限制的视频与 150 MiB 限额、MCP 十二工具及视频 resource 原字节交付。
- 前端生产构建（含 TypeScript）与 `pnpm eslint apps/web/src` 通过。
- 真实链接、生产上游及公网 MCP 客户端未验收。上线后需确认两个平台的图片及视频各一条，检查单张/ZIP/MP4 文件；Bot 连接器应发现十二工具，并同步仓库内更新后的 image-workbench Skill。

## 上游依据

- [DouK 5.8 提取器](https://github.com/JoeanAmier/TikTokDownloader/blob/473c90ff70c663cfb69310fff2b8d5192f200661/src/extract/extractor.py)：视频 downloads 单个地址，图集数组。
- [XHS 视频适配](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/application/video.py) 与 [应用流程](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/application/app.py)：视频返回地址数组，originVideoKey 生成 sns-video-bd.xhscdn.com 地址。
