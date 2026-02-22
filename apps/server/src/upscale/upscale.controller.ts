/**
 * @file upscale.controller.ts
 * @description REST API 控制器，暴露图像画质增强端点
 * @pos 控制器层 - 处理画质增强 API 的 HTTP 请求/响应
 */
import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common'
import { ApiResponse } from '../common/dto/api-response.dto'
import { UpscaleImageDto } from './dto/upscale-image.dto'
import { UpscaleService } from './upscale.service'

@Controller('upscale')
export class UpscaleController {
  private readonly logger = new Logger(UpscaleController.name)

  constructor(private readonly upscaleService: UpscaleService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async upscaleImage(@Body() dto: UpscaleImageDto): Promise<ApiResponse<{ image: string }>> {
    this.logger.log('POST /api/upscale 已进入控制器')
    const enhancedImage = await this.upscaleService.upscaleImage(dto)
    return ApiResponse.success({ image: enhancedImage }, '图像画质增强成功')
  }
}
