/**
 * @file api-response.dto.ts
 * @description 统一的 API 响应格式
 * @pos DTO 层 - 定义标准化的响应结构
 */

export class ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  timestamp: string

  constructor(partial: Partial<ApiResponse<T>>) {
    Object.assign(this, partial)
    this.timestamp = new Date().toISOString()
  }

  static success<T>(data: T, message?: string): ApiResponse<T> {
    return new ApiResponse({
      success: true,
      data,
      message,
    })
  }

  static error(message: string): ApiResponse<null> {
    return new ApiResponse({
      success: false,
      message,
    })
  }
}
