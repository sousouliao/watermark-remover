/**
 * @file remove-watermark.dto.ts
 * @description 水印移除请求的数据传输对象，验证图片和蒙版输入
 * @input image (Base64 字符串或 URL), mask (Base64 字符串或 URL)
 * @output RemoveWatermarkDto 类实例
 * @pos DTO 层 - 验证和转换传入的请求数据
 */
import { IsNotEmpty, IsString } from 'class-validator'

export class RemoveWatermarkDto {
  @IsString()
  @IsNotEmpty()
  image: string // Base64 编码的图片或 URL

  @IsString()
  @IsNotEmpty()
  mask: string // Base64 编码的蒙版或 URL
}
