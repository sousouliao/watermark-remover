/**
 * @file app.service.ts
 * @description 根应用服务，提供基础的 hello world 功能
 * @input 无 (占位符服务)
 * @output AppService (导出的类，包含 getHello 方法)
 * @pos 根服务 - 占位符，如果不需要可以删除
 */
import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!'
  }
}
