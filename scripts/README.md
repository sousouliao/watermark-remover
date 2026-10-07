# 小红书图片下载验证

独立 HTTP 探针，不启动应用、不调用模型、不读取 Cookie。使用仓库已有的 `tsx`；Node.js 20+ 安装项目依赖后即可运行。Node.js 22.18+ 或 24 也可以直接运行 `.ts`。

## 输入与运行

将新复制的分享文本或链接保存为 `.local/xhs-verification/samples.json`，格式为 1–10 条字符串组成的 JSON 数组。每条只验证一个笔记，推荐 5–10 条，覆盖单图、多图及不同作者。这个目录已加入 Git 忽略，输入中的分享 token 不能复制到知识库或提交。

```powershell
pnpm exec tsx scripts/xhs-verify.ts --input .local/xhs-verification/samples.json --label local
```

输出在 `.local/xhs-verification/<UTC时间>-<label>/`：每条笔记一个文件夹，`01-preview.*` 与 `01-candidate.*` 分别为预览和实验性候选下载资源，`report.json` 保存顺序、页面声明尺寸、文件头尺寸、格式、大小、SHA-256、失败阶段与人工检查状态。报告包含私有资源链接，不提交。不会保存原始 HTML。

如果系统 DNS 返回 `198.18.x.x` 等代理虚拟地址，默认会拒绝请求。可显式使用公共 DNS 模式，保留公网 IP 校验、IP 绑定和 TLS 校验；只向公共 DNS 发送域名，不发送分享 token，也不修改系统代理或 DNS 设置：

```powershell
pnpm exec tsx scripts/xhs-verify.ts --input .local/xhs-verification/samples.json --label local-public-dns --dns cloudflare
```

请求总超时 25 秒（含 DNS 与重定向）、最多 5 次跳转，页面最多 4 MiB、单图最多 30 MiB、单笔记最多 80 张。顺序下载两种资源，请求间隔 200 ms，笔记间隔 1 秒，无自动重试。非全部下载时退出码为 1；退出码 0 也只是全部文件已下载，尚未完成质量验收。

## 验收

- `downloaded-awaiting-review`：所有预览和候选均已保存，仍需检查图片解码与质量。
- `partial`：部分资源失败或候选 URL 规则不匹配，不能用预览成功代替无水印下载成功。
- `failed`：笔记数据未取得，查看 `stage` 和 `error.code`；跳转到登录页属于 `access-restricted`。

逐张打开文件，对照原笔记检查数量、顺序、完整解码、尺寸和可见水印。文件头检查不能代替解码；候选 URL 不是平台保证的原始文件接口。分别记录平台附加水印和作者已写入内容的水印，不把后者当作解析失败。下载图不能解码或只有缩略图时不通过验收。

本机至少通过单图和多图笔记后，才进入腾讯云对照：使用现有 SSH，在独立临时目录复制脚本和私有输入，以同一版本运行 `--label cloud`。Node.js 22.18+/24 可直接用 `node scripts/xhs-verify.ts ...`，无需安装依赖；Node.js 20 使用 `tsx`。不复制模型密钥，不更改现有服务，不开放端口。云端默认用系统 DNS；如改用公共 DNS，必须保留 `dnsMode` 的区别。若链接失效，更新后先在本机复跑，再进行同批云端比较。

## 针对性检查

```powershell
pnpm exec tsx --test scripts/xhs-verify.test.ts
pnpm exec eslint scripts/xhs-verify.ts scripts/xhs-verify.test.ts
pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --types node --skipLibCheck scripts/xhs-verify.ts scripts/xhs-verify.test.ts
```

候选资源规则仅参照公开下载器的行为独立实现，未引入其代码或依赖：https://github.com/JoeanAmier/XHS-Downloader/blob/master/static/XHS-Downloader.js 。SSR 解析只接受 JSON 对象和字符串外的 `undefined` 值，不执行表达式；不匹配的页面格式明确报错，待真实样本再决定是否扩展。
