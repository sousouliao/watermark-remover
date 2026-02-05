import type { RemoveWatermarkDto } from './dto/remove-watermark.dto'
import type { WatermarkService } from './watermark.service'
/**
 * @file watermark.controller.ts
 * @description REST API 控制器，暴露水印移除端点
 * @pos 控制器层 - 处理水印移除 API 的 HTTP 请求/响应
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiResponse } from '../common/dto/api-response.dto'

@Controller('watermark')
export class WatermarkController {
  constructor(private readonly watermarkService: WatermarkService) {}

  @Post('remove')
  @HttpCode(HttpStatus.OK)
  async removeWatermark(@Body() dto: RemoveWatermarkDto): Promise<ApiResponse<{ image: string }>> {
    const processedImage = await this.watermarkService.removeWatermark(dto)
    return ApiResponse.success({ image: processedImage }, '水印移除成功')
  }
}
