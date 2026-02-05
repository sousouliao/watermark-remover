import type { OnModuleInit } from '@nestjs/common'
import type { RemoveWatermarkDto } from './dto/remove-watermark.dto'
import { Buffer } from 'node:buffer'
/**
 * @file watermark.service.ts
 * @description 通过 Hugging Face Gradio Space 处理水印移除的服务
 * @pos 服务层 - 通过外部 AI 服务进行水印移除的业务逻辑
 */
import process from 'node:process'
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'

// 水印移除配置接口
interface WatermarkRemovalConfig {
  prompt: string
  negativePrompt: string
  guidanceScale: number
  steps: number
  strength: number
  scheduler: string
}

// 默认配置
const DEFAULT_CONFIG: WatermarkRemovalConfig = {
  prompt: 'clean background, high quality, realistic texture, seamless integration',
  negativePrompt:
    'watermark, text, logo, blurry, artifacts, distortion, bad quality, lowres, extra digits, human, character',
  guidanceScale: 7.5,
  steps: 30,
  strength: 0.85,
  scheduler: 'EulerDiscreteScheduler',
}

@Injectable()
export class WatermarkService implements OnModuleInit {
  private readonly logger = new Logger(WatermarkService.name)
  private readonly spaceUrl
    = process.env.HUGGINGFACE_SPACE_URL ?? 'diffusers/stable-diffusion-xl-inpainting'

  async onModuleInit() {
    this.logger.log(`WatermarkService 已初始化，目标 Space: ${this.spaceUrl}`)
  }

  /**
   * 将 Data URI 转换为 Blob
   */
  private dataURItoBlob(dataURI: string): Blob {
    const matches = dataURI.match(/^data:(.+);base64,(.+)$/)
    if (!matches) {
      throw new HttpException('无效的图片格式', HttpStatus.BAD_REQUEST)
    }
    const mimeType = matches[1]
    const base64Data = matches[2]
    const binaryData = Buffer.from(base64Data, 'base64')
    return new Blob([binaryData], { type: mimeType })
  }

  /**
   * 移除图片水印
   */
  async removeWatermark(
    dto: RemoveWatermarkDto,
    config: Partial<WatermarkRemovalConfig> = {},
  ): Promise<string> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config }
    // 如果 DTO 中提供了 prompt，覆盖配置
    if (dto.prompt) {
      mergedConfig.prompt = dto.prompt
    }

    try {
      this.logger.log('开始处理水印移除请求')

      // 动态导入 @gradio/client，因为它可能是 ESM 模块
      // 使用 eval('import(...)') 绕过 TypeScript 的 CommonJS 转换
      // eslint-disable-next-line no-eval
      const { Client, handle_file } = await (eval('import("@gradio/client")') as Promise<
        typeof import('@gradio/client')
      >)

      // 连接到 Gradio Space
      const app = await Client.connect(this.spaceUrl, {
        token: process.env.HUGGINGFACE_ACCESS_TOKEN as `hf_${string}`,
      })

      // 准备图片数据
      let imageBlob: Blob
      let maskBlob: Blob

      // 处理原图
      if (dto.image.startsWith('http')) {
        const response = await fetch(dto.image)
        imageBlob = await response.blob()
      }
      else {
        imageBlob = this.dataURItoBlob(dto.image)
      }

      // 处理蒙版
      if (dto.mask.startsWith('http')) {
        const response = await fetch(dto.mask)
        maskBlob = await response.blob()
      }
      else {
        maskBlob = this.dataURItoBlob(dto.mask)
      }

      this.logger.log('正在提交任务到 Gradio...')

      // 调用 predict 接口
      const result = await app.predict('/predict', {
        input_image: {
          background: handle_file(imageBlob),
          layers: [handle_file(maskBlob)],
          composite: null,
        },
        prompt: mergedConfig.prompt,
        negative_prompt: mergedConfig.negativePrompt,
        guidance_scale: mergedConfig.guidanceScale,
        steps: mergedConfig.steps,
        strength: mergedConfig.strength,
        scheduler: mergedConfig.scheduler,
      })

      this.logger.debug('Gradio 返回结果:', result)

      const data = result.data as any

      if (Array.isArray(data) && data.length > 0) {
        const outputImage = data[0] // 或者是 data[1]，通常 Slider 返回两张图

        let targetImage = null
        if (Array.isArray(outputImage)) {
          // 如果是 [img1, img2]
          targetImage = outputImage[1] || outputImage[0]
        }
        else {
          targetImage = outputImage
        }

        if (targetImage?.url) {
          this.logger.log('水印移除处理完成')
          return targetImage.url
        }
      }

      throw new HttpException('水印移除服务未返回有效图片', HttpStatus.INTERNAL_SERVER_ERROR)
    }
    catch (error: any) {
      this.logger.error('移除水印时出错', error)
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException(
        `移除水印失败: ${error?.message || error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}
