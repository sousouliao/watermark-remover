# XHS-Downloader API 部署方案核对

日期：2026-10-13。延续[直接接入评估](2026-10-11-xhs-downloader-integration-review.md)，本轮仅阅读官方资料与源码，没有安装依赖、构建镜像、启动服务、调用真实笔记或部署云端。

## API 是谁部署

官方提供的是**可自行运行的 API 模式**。README 要求先执行 `python main.py api`，再访问本机 `http://127.0.0.1:5556/docs`；Docker 使用方式也要求使用者创建并启动容器。本轮未找到作者承诺提供公众可调用的托管 API 地址、账号或服务 SLA。因此应按我们自己部署设计，镜像仓库是程序分发渠道，不是解析服务地址。依据：[官方 README 的 Docker 与服务器模式](https://github.com/JoeanAmier/XHS-Downloader/blob/master/README.md#-服务器模式)。

## 当前项目的最小合适方案

建议在运行 NestJS 的同一台机器上，另起一个 XHS-Downloader Docker 容器：`Vue → NestJS → 127.0.0.1:5556 → XHS-Downloader → 小红书`。NestJS 只请求笔记及资源地址，继续承担图片下载、ZIP 和用户错误表达。这个选择是当前部署建议，尚未成为已实现架构。

| 方式 | 对当前阶段的判断 |
| --- | --- |
| 同机独立 Docker 容器 | 首选：Python 依赖独立、可重启和固定版本，不增加服务器；宿主 NestJS 调用 loopback 地址 |
| 宿主 Python venv + 服务管理器 | 可行，但需要额外维护 Python 3.12+ 与依赖，升级和回滚比独立镜像繁琐 |
| 同机两个容器 | NestJS 本身也容器化后再采用；共用 Docker network，用服务名调用 XHS，无需发布 5556 到宿主 |
| 单独服务器或编排集群 | 当前没有证据需要，增加部署与网络管理成本；先通过真实样本和云出口验证 |

这里的选择是工程判断。上游运行基础、入口和持久化路径依据：[2.8 Dockerfile](https://github.com/JoeanAmier/XHS-Downloader/blob/2.8/Dockerfile)、[2.8 main.py](https://github.com/JoeanAmier/XHS-Downloader/blob/2.8/main.py)。不要在每次请求里启动 Python，也无需为 API 部署 Chromium。

## 已核对的部署事实

- Dockerfile 使用 Python 3.12 Debian bookworm 多阶段构建，默认命令是 TUI，API 必须覆盖为 `python main.py api`；端口为 5556，持久目录为 `/app/Volume`。依据：[2.8 Dockerfile](https://github.com/JoeanAmier/XHS-Downloader/blob/2.8/Dockerfile)。
- API 默认监听 `0.0.0.0:5556`，CLI 只选择模式，不读取额外 host/port 参数；宿主隔离应通过 Docker 的 `127.0.0.1:5556:5556` 端口发布实现。依据：[2.8 main.py](https://github.com/JoeanAmier/XHS-Downloader/blob/2.8/main.py)。
- 官方镜像名称为 `joeanamier/xhs-downloader` 和 `ghcr.io/joeanamier/xhs-downloader`。本轮 `releases/latest` 跳转 2.8；发布工作流配置版本 tag 与 latest，并声明 `linux/amd64`、`linux/arm64`、`linux/arm/v7`。这是发布配置证据，未检查镜像 registry manifest，也未验证各架构镜像构建成功。依据：[官方 README](https://github.com/JoeanAmier/XHS-Downloader/blob/master/README.md#️-docker-运行)、[release 2.8](https://github.com/JoeanAmier/XHS-Downloader/releases/tag/2.8)、[发布工作流](https://github.com/JoeanAmier/XHS-Downloader/blob/master/.github/workflows/Release_docker_image.yml)。
- `download=false` 仍会初始化记录状态，保留独立 Volume；`check_record=false` 避免历史记录影响解析。接口无需下载媒体文件来取得地址。依据：[API 与状态初始化源码](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/application/app.py)。
- 2.8 与本轮浏览的 master 都仍有三处 `verify=False`：Manager 两个 AsyncSession、传 Cookie 分支一次请求。上线前应在固定源码上改为开启 TLS 校验并验收；只给本地 API 加 HTTPS 不能修复访问小红书时关闭 TLS 校验的问题。依据：[2.8 Manager](https://github.com/JoeanAmier/XHS-Downloader/blob/2.8/source/module/manager.py)、[2.8 Request](https://github.com/JoeanAmier/XHS-Downloader/blob/2.8/source/application/request.py)、[master Manager](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/module/manager.py)、[master Request](https://github.com/JoeanAmier/XHS-Downloader/blob/master/source/application/request.py)。

## 命令模板（未执行）

正式试接优先从已审阅版本自构建，以便保留 TLS 最小补丁；不要直接依赖可变的 latest。下例选择 2.8，获取后保存实际提交 SHA；如沿用 10 月 11 日评估的 `3261312721f0b37c705ba6515885bc7f34349f2f`，应明确 checkout 该 SHA，不能把本轮 master 内容视为那个提交的内容。

```bash
git clone --branch 2.8 --depth 1 https://github.com/JoeanAmier/XHS-Downloader.git xhs-upstream
git -C xhs-upstream rev-parse HEAD
# 在 source/module/manager.py 和 source/application/request.py
# 将上述三处 verify=False 改为 verify=True，记录补丁和实际提交 SHA。
docker build -t watermark-xhs:2.8-tls1 ./xhs-upstream
```

已有镜像后可使用下面单服务 Compose；它是独立部署示例，不是当前仓库已经新增的配置。`image` 应替换为我们构建并验收过的镜像，部署记录保存镜像 ID/digest。

```yaml
services:
  xhs-parser:
    image: watermark-xhs:2.8-tls1
    command: ["python", "main.py", "api"]
    restart: unless-stopped
    ports:
      - "127.0.0.1:5556:5556"
    volumes:
      - xhs-parser-data:/app/Volume
volumes:
  xhs-parser-data:
```

也可直接运行：

```bash
docker run -d --name xhs-parser --restart unless-stopped \
  -p 127.0.0.1:5556:5556 \
  -v xhs-parser-data:/app/Volume \
  watermark-xhs:2.8-tls1 python main.py api
curl --fail http://127.0.0.1:5556/openapi.json
curl --fail -H 'Content-Type: application/json' \
  -d '{"url":"此处替换为新分享链接","download":false,"check_record":false}' \
  http://127.0.0.1:5556/xhs/detail
```

端口 loopback 发布行为依据：[Docker 官方端口发布文档](https://docs.docker.com/engine/network/port-publishing/)；接口与参数依据：[官方 API 说明](https://github.com/JoeanAmier/XHS-Downloader/blob/master/README.md#api-模式)。HTTP 成功仅是传输成功，仍须检查返回 data、笔记类型及非空下载地址，见前一轮接入评估。Compose 不设置尚未测出的内存/CPU 配额。

## 尚待验收

三条真实长链接的云端匿名串行验证已通过，详见下文。单图、真实短链、并发及长期稳定性仍未验收；产品响应适配与 NestJS/Vue 接入尚未实施。本轮小样本不代表所有链接均可解析或长期可用。

## 云端部署与机主回传验收

机主回传：目标为腾讯云轻量 Ubuntu，2 核、1.9 GiB 内存（可用约 1.2 GiB）、磁盘剩余 22 GiB；Docker 29.1.3、Compose 2.40.3，无现有容器，5556 空闲。机主的服务器助手已修复镜像拉取，Docker Hub 已通过 hello-world/alpine 拉取验证；这些是机主回传事实，本地没有直接检查服务器。

为避免目标机器从源码编译全部依赖，本次下发方案改为先拉官方 Docker Hub `joeanamier/xhs-downloader:2.8`，记录实际 RepoDigest，再基于该 digest 构建 `watermark-xhs:2.8-tls1` 派生镜像；补丁仅修改两个已审阅源码文件中的三处 TLS 校验开关，替换数量不符则停止。不自动回退 latest，不将 TLS 关闭作为失败修复。

Compose 仅发布 `127.0.0.1:5556:5556`，启动 `python main.py api`，持久化 `/app/Volume`，初始限制 512 MiB、1 CPU、256 PID，并配置日志轮转和 `/openapi.json` 存活检查。512 MiB 是针对当前可用内存的初始保护值，未经容量验收。仅设 `PYTHONUNBUFFERED=1`，不导入账号 Cookie、代理或模型密钥。

完整任务与部署文件保存在 Git 忽略的 `.local/xhs-verification/cloud-deployment/`，目标目录为 `/opt/watermark-xhs`。Webhook 返回 HTTP 200、success=true，任务 ID `47bedc4d-80de-4ad4-8fe8-ed51b39c31e9`；这仅代表任务被接收，助手仍按机主确认规则执行。启动验收包含 API 版本/参数、端口、health、OOM/restart 和资源占用。本次未下发真实笔记链接；等待机主转发执行结果后继续样本验证，尚不能标记部署成功。

首次任务在转交执行端时只保留摘要，三个文件原文未持久保存，因此未产生服务器改动。随后重发完整原文、SHA-256 和持久保存/原样转交要求；一次平台全局限流拒绝后重试成功，任务 ID `8f7b8503-8b62-4f76-8c7f-ecdec7951aec`。

2026-10-13 机主回传部署已完成且通过验收：`watermark-xhs-parser` 运行中，XHS-Downloader 2.8 API 已启动，仅绑定 `127.0.0.1:5556`，TLS 补丁三处命中，512 MiB/1 CPU 限制生效，无 OOM，重启 0 次。这是机主回传的部署与启动验收结论；尚未收到实际镜像 digest、OpenAPI 原文或真实笔记结果，不据此宣称图片解析或下载成功。

机主随后提供三条新复制的公开图文长链接，已保存至 Git 忽略的本地验证目录，并通过 webhook 下发匿名串行解析、候选媒体下载、Pillow 完整解码、实际尺寸/格式/哈希记录和可见水印复核任务。样本标题为「薄荷波点♡」「【正片】纳西妲兔兔装cos」「在🇬🇧一路被夸的现代芙穿搭」；不将分享 token 或资源 URL 写入知识库。

验证任务返回 HTTP 200、success=true，任务 ID `3e5be213-6aa1-499a-aad1-b62e2af349a2`。要求首先持久保存输入并原样转交执行端，真实报告与媒体保存在服务器私有时间戳目录，只回传脱敏摘要和联系图。

## 云端匿名真实样本验证结果

2026-10-13 机主回传成功摘要与三张联系图。服务器验证目录为 `/opt/watermark-xhs/verification/20261013-153532`，私有完整报告为该目录下 `reports/private_full.json`。镜像为 `watermark-xhs:2.8-tls1`，回传的镜像 ID 缩写为 `sha256:b71b75ba…bbe38`，基础 digest 缩写为 `joeanamier/xhs-downloader@sha256:5878c097…a53fb9`；没有收到完整 digest，不将缩写作为可拉取的固定引用。

| 样本 | 解析耗时 | 类型 | 返回/下载/完整解码 | 候选实际尺寸与格式 |
| --- | --- | --- | --- | --- |
| 薄荷波点♡ | 6.7 秒 | 图文 | 2/2/2 | 1910×2546、2236×2992 JPEG |
| 【正片】纳西妲兔兔装cos | 6.9 秒 | 图文 | 2/2/2 | 两张均 2730×4096 JPEG |
| 在🇬🇧一路被夸的现代芙穿搭 | 4.4 秒 | 图文 | 6/6/6 | 五张 1536×2560，一张 2304×3840 JPEG |

回传确认 Cookie 无预注入；容器前后均 healthy，OOMKilled=false，restart=0，内存约 89→92 MiB/512 MiB，端口和 TLS 补丁保持不变。第一条尺寸与此前本机候选图片基准一致；本次没有收到逐图哈希，不能声称与本机文件逐字节一致。上述解码、时延及资源数字来自服务器助手经机主转发的摘要，本地未读取私有完整报告。

本轮直接检查机主附带的三张联系图，共 10 张候选缩略图，未发现明显平台附加的可见水印。该结论限于联系图尺度，未逐张检查全分辨率文件，不能保证无细小/隐藏水印，也不能证明是作者上传的原始文件。

结论：这批长链接的云端匿名 API → 候选图片下载 → 完整解码链路已通过验证，可据此进入产品接入阶段。没有短链或单图样本；不宣称并发或长期稳定性已通过。本轮任务到此完成，不额外扩大验证。
