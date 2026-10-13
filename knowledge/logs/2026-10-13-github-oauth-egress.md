# GitHub OAuth 出站连通性修复

## 已确认情况

机主已确认生产 `POST /api/auth/github/exchange` 返回 502 的原因：广州 Lighthouse 主机将 `github.com` 解析到 `20.205.243.166`，HTTPS 连接挂起，journal 显示换令牌约 30 秒后失败；`api.github.com` 可访问。机主已在 `/etc/hosts` 应用 `140.82.114.3 github.com`，并验证令牌端点能及时返回。mihomo 已安装但禁用，`/etc/mihomo` 缺失。本次未重新调查远端网络，也未操作服务器。

## 仓库修改

- Go 服务继续克隆 DefaultTransport，代理改为 `http.ProxyFromEnvironment`，允许运维通过 `HTTP_PROXY` / `HTTPS_PROXY` 配置代理。
- OAuth Exchange 的 context deadline、`url.Error` / `net.Error` 返回明确的 github.com 出站连通性中文 502 提示；其他授权失败保持原提示，不输出上游错误或凭证。
- 增加模拟 transport 测试，覆盖 deadline、超时、DNS、连接关闭及普通授权拒绝，无需访问 GitHub。
- [部署说明](../../deploy/README.md)补充 hosts 临时绕行、IP 变化后的令牌端点 curl 复验及 mihomo 环境代理配置。

## 验证与边界

在 `apps/server` 执行 `go test ./...` 全部通过，`git diff --check` 通过。修改保持未提交、未推送；仓库代码尚未部署，真实登录成功仍需部署后验收。hosts 绕行由机主先前完成，本次测试不证明生产登录或 IP 长期有效。
