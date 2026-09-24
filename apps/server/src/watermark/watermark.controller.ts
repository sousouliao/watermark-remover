/**
 * @file watermark.controller.ts
 * @description REST API 控制器，暴露水印移除端点
 * @pos 控制器层 - 处理水印移除 API 的 HTTP 请求/响应
 */
import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common'
import { ApiResponse } from '../common/dto/api-response.dto'
import { RemoveWatermarkDto } from './dto/remove-watermark.dto'
import { WatermarkService } from './watermark.service'

@Controller('watermark')
export class WatermarkController {
  private readonly logger = new Logger(WatermarkController.name)

  constructor(private readonly watermarkService: WatermarkService) {}

  @Post('remove')
  @HttpCode(HttpStatus.OK)
  async removeWatermark(@Body() dto: RemoveWatermarkDto): Promise<ApiResponse<{ image: string, model: string }>> {
    this.logger.log('POST /api/watermark/remove 已进入控制器')
    const result = await this.watermarkService.removeWatermark(dto)
    return ApiResponse.success(result, '水印移除成功')
  }
}
