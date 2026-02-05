import type { AppService } from './app.service'
/**
 * @file app.controller.ts
 * @description 根应用控制器，提供基础端点
 * @pos 根控制器 - 应用根路由处理
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
