# 分离部署

Vue 前端发布到 Vercel；Go API 使用 systemd，XHS-Downloader 保持已有独立容器。

## 前端与 GitHub

Vercel 项目为 `xcm1115s-projects/watermark-remover`，仓库根目录构建，只输出 `apps/web/dist`。配置生产环境 `VITE_API_BASE_URL=https://43.138.214.93`，正式地址以发布结果为准。

在 GitHub Settings → Developer settings → OAuth Apps 注册应用：Homepage 为正式前端 origin；Authorization callback 为 `<正式前端 origin>/auth/callback`。不启用 Device Flow，不申请仓库或 email scope。Client ID/Secret 写入服务器 `/etc/watermark-api.env`，不可写入 Vercel 前端变量。唯一允许用户为 `37927306`。

## Go 服务

构建使用 Go 1.27.2，运行程序无 Go/Node 运行时依赖：

```sh
cd apps/server
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o dist/server ./cmd/server
```

确认服务器架构后选择对应二进制。每版部署至 `/opt/watermark-api/releases/<版本>/server`，`current` 指向当前版本；服务账户 `watermark-api` 无登录 shell。复制 systemd unit 后执行 daemon-reload、enable、start。覆盖版本前保留上一个 current 目标用于回滚。

`/etc/watermark-api.env` 使用 root:root、0600，值包含：

```text
LISTEN_ADDR=127.0.0.1:3000
FRONTEND_URL=<正式前端 origin>
XHS_API_URL=http://127.0.0.1:5556
DOUYIN_API_URL=http://127.0.0.1:5555
GITHUB_ALLOWED_USER_ID=37927306
GITHUB_CLIENT_ID=<client ID>
GITHUB_CLIENT_SECRET=<secret>
ARK_API_KEY=<server key>
ARK_SEEDREAM_LITE_ENDPOINT=<endpoint>
ARK_SEEDREAM_FLASH_ENDPOINT=<endpoint>
```

缺少 OAuth 配置时业务接口保持 401，登录开始返回 503；缺少模型配置时去水印返回 503。不能据此标记完整上线成功。

### GitHub 登录出站连通性

广州主机可能无法连接 `github.com`，即使 `api.github.com` 可访问；OAuth 换令牌必须访问 `https://github.com/login/oauth/access_token`。生产已临时在 `/etc/hosts` 使用以下映射：

```text
140.82.114.3 github.com
```

IP 可能变化，应用或调整映射后用 `curl --connect-timeout 5 --max-time 15 -X POST https://github.com/login/oauth/access_token` 重新验证是否及时收到响应（无需发送凭证；这不验证登录成功）。也可配置并启用 mihomo，再在 `/etc/watermark-api.env` 设置 `HTTPS_PROXY=http://127.0.0.1:<mihomo HTTP 代理端口>`，重启 Go 服务；HTTP 请求支持 `HTTP_PROXY`，按需设置 `NO_PROXY` 排除直连目标。当前 mihomo 已安装但禁用，且 `/etc/mihomo` 缺失，启用前需补齐配置。

## 公网 IP HTTPS

确认 80/443 无冲突且轻量防火墙允许访问；保留已有 Nginx 站点，单独增加配置。先加载 `nginx-http.conf`（确保 nginx -t 通过），建立 `/var/www/watermark-acme`。使用 Certbot 5.4+ 的 webroot/IP/shortlived 支持，先测试再生产：

```sh
certbot certonly --staging --preferred-profile shortlived --webroot \
  --webroot-path /var/www/watermark-acme --ip-address 43.138.214.93 \
  --cert-name watermark-ip-staging --agree-tos --register-unsafely-without-email --non-interactive
certbot certonly --preferred-profile shortlived --webroot \
  --webroot-path /var/www/watermark-acme --ip-address 43.138.214.93 \
  --cert-name 43.138.214.93 --agree-tos --register-unsafely-without-email --non-interactive \
  --deploy-hook 'nginx -t && systemctl reload nginx'
```

启用 `nginx-https.conf` 后 nginx -t 并 reload；仅在这两步成功后对外验收。确保 Certbot 自动续期 timer 生效，执行生产证书 `renew --cert-name 43.138.214.93 --dry-run --run-deploy-hooks`。IP 证书约六天有效，续期是上线验收项。[Let’s Encrypt 官方说明](https://letsencrypt.org/2026/03/11/shorter-certs-certbot.html)

先检查 HTTPS health、未经登录业务请求 401、未配置登录 503 与精确 CORS；补齐 OAuth 后验收真实登录及各业务流程。3000/5555/5556 保持仅本机监听。


## DouK 抖音解析 sibling（部署说明，尚未部署）

使用官方 [DouK-Downloader](https://github.com/JoeanAmier/TikTokDownloader) 的 **Web API 模式**。本次适配核对版本为 5.8 stable、源码提交 `473c90ff70c663cfb69310fff2b8d5192f200661`；部署时固定已核对版本的镜像 digest，避免 latest 漂移。官方镜像名为 `ghcr.io/joeanamier/tiktok-downloader`，容器内部监听 5555，持久目录为 `/app/Volume`。可按以下示例初始化（先设置 `DOUK_IMAGE` 为已核对镜像的完整 digest 引用）：

```sh
docker run --name watermark-douk --restart unless-stopped \
  --memory=512m --cpus=1 \
  -p 127.0.0.1:5555:5555 \
  -v watermark_douk_volume:/app/Volume \
  -it "${DOUK_IMAGE:?set a verified DouK image digest first}"
```

官方入口为交互菜单，选择「Web API 模式」，确认容器重启后仍进入该模式再接入 systemd 后端；不要把仅容器启动视作 API 就绪。仅从主机访问 `http://127.0.0.1:5555/docs` / `/openapi.json`，核对 `/douyin/share`、`/douyin/detail` 与响应字段，再以一条真实普通图集验收 Go 的解析、单图、ZIP 及视频 422。上游限流、访问限制或未来接口变化仍可能阻止真实解析；Cookie 不通过本应用收集或传入。

**不开放公网 5555**，不增加 Nginx 的 DouK 代理，也不为 5555 开安全组；XHS 原有 `127.0.0.1:5556` 不变。Go 配置 `DOUYIN_API_URL=http://127.0.0.1:5555`。CDN 白名单的初始策略与真实样本 TODO 见 [Go API 说明](../apps/server/README.md#抖音图集下载后端)。本任务未操作生产主机。
