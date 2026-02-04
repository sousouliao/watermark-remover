import type { AppService } from './app.service'
/**
 * @file app.controller.ts
 * @description 根应用控制器，提供基础的 hello world 端点
 * @input AppService 用于业务逻辑
 * @output AppController (导出的类，包含 GET / 端点)
 * @pos 根控制器 - 占位符，如果不需要可以删除
 */
import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello()
  }
}
