/**
 * @file app.service.ts
 * @description 根应用服务，提供基础功能
 * @pos 根服务 - 应用级别的通用服务
 */
import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getHello(): string {
    return 'Watermark Remover API is running!'
  }
}
