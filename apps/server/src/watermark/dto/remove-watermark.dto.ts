/**
 * @file remove-watermark.dto.ts
 * @description 水印移除请求的数据传输对象，验证图片和蒙版输入
 * @pos DTO 层 - 验证和转换传入的请求数据
 */
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class RemoveWatermarkDto {
  /**
   * Base64 编码的图片或图片 URL
   */
  @IsString()
  @IsNotEmpty()
  image: string

  /**
   * Base64 编码的蒙版或蒙版 URL
   * 蒙版应为白色标记需要移除水印的区域
   */
  @IsString()
  @IsNotEmpty()
  mask: string

  /**
   * (可选) 提示词，用于指导 AI 填补区域的内容
   * 默认为空，让 AI 根据周围环境自动推断
   */
  @IsString()
  @IsOptional()
  prompt?: string
}
