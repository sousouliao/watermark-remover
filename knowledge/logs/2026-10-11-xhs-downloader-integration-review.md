# XHS-Downloader 直接接入评估

## 范围与维护状态

用户要求详细检查是否直接复用 XHS-Downloader，避免自写解析轮子。本轮阅读官方仓库的 API、模型、页面请求、图片资源、下载处理、Dockerfile、构建流程和许可证；没有安装、启动或接入服务，也没有替该项目声称匿名解析已在本项目样本上通过。

截至 2026-10-11，GitHub 最新 release 为 **2.8**，发布于 2026-09-12；master HEAD 为 `3261312721f0b37c705ba6515885bc7f34349f2f`，提交时间 2026-09-16。仓库未归档，仓库 pushed_at 为 2026-10-09；pushed_at 不等于 master 最近提交时间。2.8 明确从 httpx 转为 curl_cffi，修复分享链接和解析异常，说明项目仍有维护活动，但不等于维护者承诺生产 SLA。

依据：[release 2.8](https://github.com/JoeanAmier/XHS-Downloader/releases/tag/2.8)、GitHub 仓库/commits/releases API。以下行为以本轮查看的 master 和 2.8 参数模型为依据，部署固定版本后仍须检查实际 OpenAPI。

## 接口与图片能力

[API 实现](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/application/app.py)提供 `POST /xhs/detail`，参数见[模型](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/module/model.py)：`url`、`download=false`、`index`、`cookie`、`proxy`、`check_record=true`。单次处理第一个提取出的笔记；适合单分享链接的当前产品目标。

建议只用解析模式：传 `url`、`download=false`、`check_record=false`，不向公众暴露 Cookie/proxy 参数。返回包为 `{message, params, data}`，data 是扁平中文字段的字典或 null，包括作品 ID、标题、描述、类型、作者和下载地址；不是前端可以直接使用的标准化 `images[]`。解析失败可能仍是 HTTP 200；既有下载记录可返回只有 message 的 data，必须检查笔记 ID、类型和非空地址列表，不能只看 HTTP 200 或 data 非 null。

[图片 URL 生成](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/application/image.py)从 urlDefault/url 取得资源标识，JPEG 配置生成 `https://ci.xiaohongshu.com/<资源标识>?imageView2/format/jpeg`，与本项目已验证的候选图片路径一致。支持 PNG/WebP/JPEG/HEIC/AVIF/AUTO 等格式，但不保证所有图片都提供所有格式，也不保证作者原始文件。

API 数据没有逐图实际尺寸及单独预览清单；这些仍须通过媒体响应/解码补足。download=true 会下载到服务端目录，而非给 HTTP 调用方直接返回图片或 ZIP；download=false 也不代表进程完全无磁盘活动，初始化的记录库、作者映射等仍需 Volume。

## 推荐接法（尚未实施）

Vue → 本项目 NestJS → 内网 XHS-Downloader API，仅取得笔记和候选地址；NestJS 继续负责资源校验、预览/下载、文件名、ZIP、缓存和对用户的错误表达。XHS-Downloader 负责平台链接、页面解析与资源规则。这样可以复用维护最频繁的解析部分，又不把 GUI、剪贴板、下载记录、账号 Cookie 变成产品依赖。

Python 3.12+、FastAPI、curl_cffi 为主要运行基础，API 路径无需 Playwright/Chromium。[官方 Dockerfile](https://github.com/JoeanAmier/XHS-Downloader/blob/master/Dockerfile)默认启动 TUI，API 必须显式运行 `python main.py api`，容器内端口 5556，持久目录 `/app/Volume`。优先独立容器，只连接 NestJS；不直接把无鉴权上游 API 暴露公网。不要每个请求创建 Python 子进程，也不复制解析代码到 NestJS。

## 接入前必须解决或验收的具体问题

1. **TLS 校验**：[Manager](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/module/manager.py)的两个 AsyncSession 和[传入 Cookie 的请求分支](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/application/request.py)仍使用 verify=false。[Issue #488](https://github.com/JoeanAmier/XHS-Downloader/issues/488)为 open。本项目应在固定上游版本上用最小补丁启用 TLS 校验，再验证；不将关闭校验作为运行前提。
2. **边界与失败**：上游支持 caller-supplied proxy/Cookie，并把 params 回显到响应；NestJS 不透传这些能力，不回显上游 params。限制单链接输入并继续验证下载地址与重定向，data=null、缺少地址、网络超时必须映射为本项目错误。
3. **服务行为**：XHS 实例和记录状态是进程共享的，API 不是生产多租户网关；第一轮串行运行。用 check_record=false 避免历史下载记录影响解析；不默认依赖其高并发处理、细粒度风控错误或文件下载状态。
4. **版本**：固定源码提交/镜像 digest，实测 OpenAPI 与契约后再升级。历史[Issue #290](https://github.com/JoeanAmier/XHS-Downloader/issues/290)有镜像与文档接口不一致的报告，不能仅按 latest 文档假定镜像可用。
5. **许可证**：[LICENSE](https://github.com/JoeanAmier/XHS-Downloader/blob/master/LICENSE)为 GPL-3.0，不是禁止商业使用。自部署使用与向他人分发修改源码/镜像的义务不同，不能简单断言调用独立 HTTP 服务会让整个项目必须 GPL，也不能宣称容器隔离自动消除许可证义务。交付分发方案需依据实际组合与分发方式核对，[GNU FAQ](https://www.gnu.org/licenses/gpl-faq.html#GPLRequireSourcePostedPublic)区分了内部使用和公开发布修改版本。

以上为直接影响接入的核对，不进行无关全仓库安全审计或重构。上游内置重试/延时不提供不被风控的保证，当前用户样本必须重新通过其真实程序验证；用户脚本可用不等于 Python API 可用。

## 下一步与建议结论

**优先试接 XHS-Downloader 的独立 API，暂停扩展自写解析器和默认 Playwright 方案。** 这是候选建议，不是已确认的新架构契约。

先固定 2.8 或上述 HEAD，在独立环境启动，确认实际 OpenAPI；无登录 Cookie、download=false、check_record=false 串行运行已有 5 条新分享链接。先验收此前已有基准的 2 条/9 张：笔记和地址完整、生成候选资源一致、文件尺寸/哈希符合基准，然后补单图、真实短链及其余样本。记录失败响应与少量跨时段表现；随后腾讯云同版本复验，接入信息仍缺。不通过则明确上游访问条件或兼容问题，不因其持续维护而跳过验收。

本轮尚未运行上游程序，运行依赖可安装性、上游样本成功率、云端可用性、资源成本及并发都未验证。已写入本记录的事实来自源码和元数据检查，不能替代实测。
