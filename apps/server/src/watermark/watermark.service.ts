import type { RemoveWatermarkDto } from './dto/remove-watermark.dto'
import { Client } from '@gradio/client'
/**
 * @file watermark.service.ts
 * @description 通过连接 Hugging Face SDXL Inpainting Space 处理水印移除的服务
 * @input RemoveWatermarkDto (图片和蒙版), @gradio/client 用于 API 调用
 * @output 处理后的图片 (已移除水印)
 * @pos 服务层 - 通过外部 AI 服务进行水印移除的业务逻辑
 */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common'

@Injectable()
export class WatermarkService {
  private client: Client
  private readonly SPACE_URL = 'diffusers/stable-diffusion-xl-inpainting'

  constructor() {
    this.initializeClient()
  }

  private async initializeClient() {
    try {
      this.client = await Client.connect(this.SPACE_URL)
    }
    catch (error) {
      console.error('连接 Hugging Face Space 失败:', error)
      throw new HttpException('初始化水印移除服务失败', HttpStatus.SERVICE_UNAVAILABLE)
    }
  }

  async removeWatermark(dto: RemoveWatermarkDto): Promise<string> {
    try {
      // 确保客户端已初始化
      if (!this.client) {
        await this.initializeClient()
      }

      // 按照 SDXL Inpainting Space 要求的顺序准备参数
      const prompt = 'high quality, realistic, clean background'
      const negativePrompt = 'watermark, text, blurry, artifacts, distortion'
      const image = dto.image
      const mask = dto.mask
      const width = 1024
      const height = 1024
      const guidanceScale = 7.5
      const steps = 30

      // 按照正确顺序调用 Hugging Face Space
      const result = await this.client.predict('/predict', [
        prompt, // 参数 1: 提示词
        negativePrompt, // 参数 2: 负面提示词
        image, // 参数 3: 图片
        mask, // 参数 4: 蒙版
        width, // 参数 5: 宽度
        height, // 参数 6: 高度
        guidanceScale, // 参数 7: 引导比例
        steps, // 参数 8: 步数
      ])

      // 从结果中提取处理后的图片
      // 结果结构可能有所不同，需要根据实际 API 响应进行调整
      if (result?.data && result.data.length > 0) {
        return result.data[0] // 返回处理后的图片
      }

      throw new HttpException('水印移除服务返回无效响应', HttpStatus.INTERNAL_SERVER_ERROR)
    }
    catch (error) {
      console.error('移除水印时出错:', error)
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException('移除水印失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
