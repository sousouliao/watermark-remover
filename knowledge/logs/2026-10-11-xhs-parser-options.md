# 小红书图片解析路线比较

## 结论与纠正

用户要求扩大可行性调研，而非直接采用 Playwright。Playwright 不是必需条件，也还没有证据表明它是本项目的最优生产方案。此前直接将云端浏览器验证作为下一步，遗漏了匿名会话 HTTP 和浏览器兼容传输客户端的比较；现改为优先补测非浏览器路线，浏览器作为对照和候选。

本项目已验证的只有：普通 Node HTTP 无 Cookie 解析失败；桌面浏览器能读取两笔记图集；取得资源后，不附带账号 Cookie 的 HTTP 下载成功。没有验证 HTTP 全部实现都不可行，也没有验证 Playwright 在云端成功。登录前后同图文件一致，故不为未经证实的画质收益引入账号登录态。

## 路线与一手实现依据

| 路线 | 社区依据 | 本项目适配与限制 |
| --- | --- | --- |
| HTTP SSR + 正常匿名会话 | [tamnd/xiaohongshu-cli 笔记解析](https://github.com/tamnd/xiaohongshu-cli/blob/main/xiaohongshu/note.go)、[会话](https://github.com/tamnd/xiaohongshu-cli/blob/main/xiaohongshu/session.go)、[Cookie 捕获](https://github.com/tamnd/xiaohongshu-cli/blob/main/xiaohongshu/client.go) | 优先补测；不启动 Chromium。保留服务端正常发放的匿名 Cookie 与无 Cookie 请求不同；不需要用户账号。项目 README 的任意 IP 可用宣称不作为本项目实测结论，也不照搬其其他签名/合成会话行为 |
| 浏览器兼容 HTTP 客户端 | [XHS-Downloader 请求实现](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/application/request.py)、[会话初始化](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/module/manager.py) | 使用 curl_cffi 而非 Chromium，值得做独立对照；可能引入 Python/原生运行依赖，不能保证云 IP 可访问，也不复制其关闭 TLS 校验的做法 |
| 浏览器执行页面 JS 后读取结构化数据 | [Playwright Library](https://playwright.dev/docs/library)、[Go Rod 的社区实现](https://github.com/Lixiansicong/xiaohongshu/blob/main/docs/TECHNICAL_DETAILS.md) | 和已有桌面成功路径相近，但必须单独验证云端；Playwright/Puppeteer/Rod 只是控制工具的选择，仍承担浏览器成本。应读取对应笔记 imageList，避免依赖点击和页面布局，不必使用 E2E Test Runner |
| 非官方签名 Web API | [MediaCrawler XHS 客户端](https://github.com/NanmiCoder/MediaCrawler/blob/main/media_platform/xhs/client.py)、[xhshow-js](https://github.com/renmu123/xhshow-js) | 结构化数据、存在 TypeScript 实现；需要签名、会话及权限判断，签名不等于匿名有访问权限。MediaCrawler 实际仍包含浏览器与登录流程。维护范围可能超出单笔记图片下载，后置考虑 |
| 用户浏览器脚本/扩展 | [XHS-Downloader 用户脚本](https://github.com/JoeanAmier/XHS-Downloader/blob/master/static/XHS-Downloader.js) | 直接读取用户正在访问页面的状态，降低服务端解析依赖；但需要安装/在小红书页面操作，改变粘贴链接即下载的产品流程。普通 Vue 网页不能直接读取另一站点的页面状态 |
| 第三方解析 API | [TikHub SDK 接口目录](https://github.com/TikHub/TikHub-API-Python-SDK/blob/main/docs/reference.md) | 有图文笔记详情和分享链接相关接口；可减少自维护解析，但涉及费用、供应商可用性、资源质量和分享链接交给第三方。没有调用或购买，不视为平台官方 API，也不视为无风控保证 |

curl_cffi 官方说明支持会话和浏览器协议指纹兼容：[Quick Start](https://curl-cffi.readthedocs.io/en/latest/quick_start.html)。兼容不代表能够执行网页 JS，也不保证绕过访问限制。访问需要登录或验证码时明确失败，不以绕过限制作为实现目标。

## 接入与维护取舍

在当前只需单条公开图文链接的目标下，应避免因为大型爬虫支持搜索、主页采集等就全量引入。媒体下载仍复用已验证的 HTTP 路径，比较重点是如何取得正确 imageList。远程浏览器或 browserless 服务只是把 Chromium 搬到别处，不构成根本上更轻的解析方式。

开源依赖选择需按仓库实际许可证核对：XHS-Downloader 为 GPL-3.0，Go CLI 为 Apache-2.0，xhshow-js 为 MIT；MediaCrawler 当前 LICENSE 为 NON-COMMERCIAL LEARNING LICENSE 1.1，明确限制商业用途，不应直接当作可商用组件引入。当前只做实现调研，未复制这些项目代码或新增依赖。

未确认有面向任意公开笔记分享链接的官方通用无水印下载 API；不能把第三方文档里的 Web/API 路径误认为官方开放平台对外承诺。

## 下一步验证建议（尚未执行）

用同一批新分享链接、同一网络出口串行比较：现有 Node 无 Cookie 探针、保留正常匿名会话的 HTTP SSR、curl_cffi 匿名 Session、无登录浏览器。先本机小批，再腾讯云相同版本；记录版本与环境，限制出现时停止，不使用 IP 轮换、验证码绕过或共享登录账号。

统一比较解析完整率、图片顺序和资源标识、候选下载尺寸/格式/文件哈希、时延、CPU/内存、运行依赖、认证/验证码/限速失败及少量跨时段复跑表现。小样本短期成功不外推为长期稳定。任何路线都不能保证不受风控；若四条路线都在某一出口受限，应报告出口/访问条件问题，不无限换框架。

若匿名 HTTP SSR 或兼容客户端稳定满足需求，优先不部署浏览器；否则再判断浏览器值得作为主路径或有条件补充。仅渲染/数据等待失败值得浏览器对照，明确认证或限速失败不无条件转浏览器再请求。第三方服务要在明确费用与真实资源验收后单独选择；用户侧扩展只有接受流程变化时再考虑。当前不修改产品代码，不直接引入 Playwright。
