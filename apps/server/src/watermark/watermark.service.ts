import type { RemoveWatermarkDto, WatermarkModel } from './dto/remove-watermark.dto'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { BadGatewayException, BadRequestException, GatewayTimeoutException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'

const ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
const REQUEST_TIMEOUT_MS = 120_000
const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const PNG_SIGNATURE = '89504e470d0a1a0a'

const PROMPT = '请仅移除图片中后加的水印文字或标识，恢复其下的原照片纹理。保留原照片中的人物、物体和原有文字，不要添加新元素或新文字。尽量保持非水印区域不变。'

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name)

  async removeWatermark(dto: RemoveWatermarkDto): Promise<{ image: string, model: WatermarkModel }> {
    const image = this.validateImage(dto.image)
    const endpoint = dto.model === 'lite'
      ? process.env.ARK_SEEDREAM_LITE_ENDPOINT
      : process.env.ARK_SEEDREAM_FLASH_ENDPOINT
    const apiKey = process.env.ARK_API_KEY

    if (!apiKey || !endpoint) {
      throw new ServiceUnavailableException('图像服务尚未配置，请联系管理员')
    }

    let prompt = PROMPT
    if (dto.mode === 'region') {
      const region = dto.region
      if (!region || region.x1 >= region.x2 || region.y1 >= region.y2) {
        throw new BadRequestException('请提供有效的水印区域坐标')
      }
      prompt = `请仅移除 <bbox>${region.x1} ${region.y1} ${region.x2} ${region.y2}</bbox> 区域内后加的水印文字或标识，恢复其下的原照片纹理。区域外保持不变；保留原照片中的人物、物体和原有文字，不要添加新元素或新文字。`
    }
    else if (dto.region !== undefined) {
      throw new BadRequestException('直接移除模式不需要区域坐标')
    }

    let response: Response
    try {
      response = await fetch(ARK_URL, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: endpoint,
          prompt,
          image,
          size: '2K',
          output_format: 'png',
          response_format: 'b64_json',
          watermark: false,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    }
    catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new GatewayTimeoutException('图像服务处理超时，请稍后重试')
      }
      this.logger.error('连接方舟图像服务失败', error instanceof Error ? error.message : String(error))
      throw new BadGatewayException('暂时无法连接图像服务，请稍后重试')
    }

    if (!response.ok) {
      this.logger.error(`方舟图像服务返回 HTTP ${response.status}，模型: ${dto.model}`)
      if (response.status === 400 || response.status === 413 || response.status === 422) {
        throw new BadRequestException('图片或区域参数不符合图像服务要求')
      }
      if (response.status === 401 || response.status === 403) {
        throw new BadGatewayException('图像服务鉴权失败，请联系管理员')
      }
      if (response.status === 408 || response.status === 504) {
        throw new GatewayTimeoutException('图像服务处理超时，请稍后重试')
      }
      if (response.status === 429) {
        throw new ServiceUnavailableException('图像服务当前繁忙，请稍后重试')
      }
      throw new BadGatewayException('图像服务处理失败，请稍后重试')
    }

    let result: unknown
    try {
      result = await response.json()
    }
    catch {
      throw new BadGatewayException('图像服务返回了无效响应')
    }

    const encoded = (result as { data?: { b64_json?: unknown }[] })?.data?.[0]?.b64_json
    if (typeof encoded !== 'string' || !/^[a-z0-9+/]+={0,2}$/i.test(encoded)
      || Buffer.from(encoded, 'base64').subarray(0, 8).toString('hex') !== PNG_SIGNATURE) {
      throw new BadGatewayException('图像服务未返回有效图片')
    }

    return { image: `data:image/png;base64,${encoded}`, model: dto.model }
  }

  private validateImage(image: string): string {
    const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image)
    if (!match || Buffer.byteLength(match[1], 'base64') > MAX_IMAGE_BYTES) {
      throw new BadRequestException('请上传不超过 30 MB 的 PNG、JPEG 或 WebP 图片')
    }
    return image
  }
}
