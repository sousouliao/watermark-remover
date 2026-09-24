# 水印移除模块

`POST /api/watermark/remove` 接收图片 data URI、`lite` / `flash` 模型选择与 `direct` / `region` 模式。区域模式接收 0–999 坐标框，转换为方舟图像编辑提示词；它不是原生硬蒙版。

控制器使用 `RemoveWatermarkDto` 验证请求。服务端从 `ARK_API_KEY`、`ARK_SEEDREAM_LITE_ENDPOINT`、`ARK_SEEDREAM_FLASH_ENDPOINT` 读取配置，请求方舟图片生成接口的单张 2K PNG Base64 输出，并返回 `{ image, model }`。服务层将参数错误、鉴权失败、超时、上游不可用和无有效图片分为可读的 HTTP 错误，不自动切换模型。

当前前端仍发旧蒙版请求；其流程改造属于阶段 2。旧 IOPaint 依赖和其他说明在阶段 3 清理。
