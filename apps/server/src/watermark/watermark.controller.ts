import type { RemoveWatermarkDto } from './dto/remove-watermark.dto'
import type { WatermarkService } from './watermark.service'
/**
 * @file watermark.controller.ts
 * @description REST API 控制器，暴露水印移除端点
 * @input 通过 POST 请求体传入 RemoveWatermarkDto, WatermarkService 用于处理
 * @output 处理后的图片 (已移除水印) 作为响应
 * @pos 控制器层 - 处理水印移除 API 的 HTTP 请求/响应
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'

@Controller('watermark')
export class WatermarkController {
  constructor(private readonly watermarkService: WatermarkService) {}

  @Post('remove')
  @HttpCode(HttpStatus.OK)
  async removeWatermark(@Body() dto: RemoveWatermarkDto) {
    const processedImage = await this.watermarkService.removeWatermark(dto)
    return {
      success: true,
      image: processedImage,
    }
  }
}
