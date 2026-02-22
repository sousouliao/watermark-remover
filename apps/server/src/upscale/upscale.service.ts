/**
 * @file upscale.service.ts
 * @description 通过 Hugging Face Real-ESRGAN Space 进行图像超分辨率增强
 * @pos 服务层 - 调用外部 AI 服务进行画质增强的业务逻辑
 */
import type { OnModuleInit } from '@nestjs/common'
import type { UpscaleImageDto } from './dto/upscale-image.dto'
import { Buffer } from 'node:buffer'
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'

/** Hugging Face Space 地址 */
const REAL_ESRGAN_SPACE = 'Nick088/Real-ESRGAN_Pytorch'

@Injectable()
export class UpscaleService implements OnModuleInit {
  private readonly logger = new Logger(UpscaleService.name)

  async onModuleInit() {
    this.logger.log(`UpscaleService 已初始化，目标 Space: ${REAL_ESRGAN_SPACE}`)
  }

  /**
   * 将 data URI 转换为 Blob
   */
  private dataUriToBlob(dataUri: string): Blob {
    const [meta, base64] = dataUri.split(',')
    const mimeMatch = meta.match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/png'
    const buffer = Buffer.from(base64, 'base64')
    return new Blob([buffer], { type: mime })
  }

  /**
   * 将二进制响应转换为 Data URI
   */
  private async responseToDataUri(response: Response): Promise<string> {
    const contentType = response.headers.get('content-type') ?? 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  }

  /**
   * 对图像进行超分辨率增强
   */
  async upscaleImage(dto: UpscaleImageDto): Promise<string> {
    const scale = dto.scale ?? 2

    try {
      this.logger.log(`开始图像画质增强，放大倍数: ${scale}x`)

      // 动态导入 @gradio/client（ESM 模块）
      const { Client } = await import('@gradio/client')

      // 连接 Hugging Face Space
      const app = await Client.connect(REAL_ESRGAN_SPACE)

      // 将 data URI 转换为 Blob
      const imageBlob = this.dataUriToBlob(dto.image)

      // 调用 /predict 端点
      const result = await app.predict('/predict', [
        imageBlob, // 输入图片
        scale, // 放大倍数
      ])

      // 解析结果
      const outputData = result.data as any[]
      if (!outputData?.[0]?.url) {
        throw new Error('Real-ESRGAN 返回数据中无有效的图片 URL')
      }

      const enhancedImageUrl: string = outputData[0].url

      // 下载增强后的图片并转换为 data URI
      const response = await fetch(enhancedImageUrl)
      if (!response.ok) {
        throw new Error(`下载增强图片失败: status=${response.status}`)
      }

      const dataUri = await this.responseToDataUri(response)
      this.logger.log('图像画质增强完成')
      return dataUri
    }
    catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error('图像画质增强失败', message)
      throw new HttpException(
        `图像画质增强失败: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}
