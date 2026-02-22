/**
 * @file upscale-image.dto.ts
 * @description 图像画质增强请求的数据传输对象
 * @pos DTO 层 - 验证和转换传入的请求数据
 */
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class UpscaleImageDto {
  /**
   * Base64 编码的图片 (data URI)
   */
  @IsString()
  @IsNotEmpty()
  image: string

  /**
   * 放大倍数: 2, 4, 8
   * 默认为 2
   */
  @IsOptional()
  @IsIn([2, 4, 8])
  scale?: 2 | 4 | 8
}
