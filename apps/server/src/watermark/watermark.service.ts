/**
 * @file watermark.service.ts
 * @description 通过 IOPaint-LaMA Space 处理水印移除的服务
 * @pos 服务层 - 通过外部 AI 服务进行水印移除的业务逻辑
 */
import type { OnModuleInit } from '@nestjs/common'
import type { RemoveWatermarkDto } from './dto/remove-watermark.dto'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'

/**
 * IOPaint LaMA 配置
 * 参考: https://github.com/Sanster/IOPaint/blob/main/iopaint/schema.py
 */
interface IOPaintConfig {
  hdStrategy: 'Original' | 'Resize' | 'Crop'
  hdStrategyCropTriggerSize: number
  hdStrategyCropMargin: number
  hdStrategyResizeLimit: number
}

const DEFAULT_IOPAINT_CONFIG: IOPaintConfig = {
  hdStrategy: 'Crop',
  hdStrategyCropTriggerSize: 800,
  hdStrategyCropMargin: 128,
  hdStrategyResizeLimit: 1280,
}

@Injectable()
export class WatermarkService implements OnModuleInit {
  private readonly logger = new Logger(WatermarkService.name)

  /**
   * IOPaint-LaMA Space 基础地址
   * 可以通过环境变量 IOPAINT_LAMA_URL 覆盖
   */
  private readonly iopaintUrl
    = process.env.IOPAINT_LAMA_URL ?? 'https://nomark.xiaoqw-liao.workers.dev'

  async onModuleInit() {
    this.logger.log(`WatermarkService 已初始化，目标 IOPaint 实例: ${this.iopaintUrl}`)
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
   * 确保输入为 data URI（如果是 URL 则先拉取再转换）
   */
  private async ensureDataUri(imageOrUrl: string): Promise<string> {
    if (!imageOrUrl.startsWith('http')) {
      return imageOrUrl
    }
    const res = await fetch(imageOrUrl)
    if (!res.ok) {
      throw new HttpException('无法拉取图片或蒙版', HttpStatus.BAD_REQUEST)
    }
    return this.responseToDataUri(res)
  }

  /**
   * 移除图片水印
   */
  async removeWatermark(
    dto: RemoveWatermarkDto,
    config: Partial<IOPaintConfig> = {},
  ): Promise<string> {
    const mergedConfig: IOPaintConfig = {
      ...DEFAULT_IOPAINT_CONFIG,
      ...config,
    }

    try {
      this.logger.log('开始处理水印移除请求 (IOPaint-LaMA)')

      const [image, mask] = await Promise.all([
        this.ensureDataUri(dto.image),
        this.ensureDataUri(dto.mask),
      ])

      const body = {
        image,
        mask,
        hd_strategy: mergedConfig.hdStrategy,
        hd_strategy_crop_trigger_size: mergedConfig.hdStrategyCropTriggerSize,
        hd_strategy_crop_margin: mergedConfig.hdStrategyCropMargin,
        hd_strategy_resize_limit: mergedConfig.hdStrategyResizeLimit,
      }

      const endpoint = `${this.iopaintUrl.replace(/\/+$/, '')}/api/v1/inpaint`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        this.logger.error(`IOPaint 调用失败: status=${response.status}, body=${text}`)
        throw new HttpException('水印移除服务调用失败', HttpStatus.BAD_GATEWAY)
      }

      const dataUri = await this.responseToDataUri(response)
      this.logger.log('水印移除处理完成 (IOPaint-LaMA)')
      return dataUri
    }
    catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error('移除水印时出错', message)
      throw new HttpException(`移除水印失败: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
