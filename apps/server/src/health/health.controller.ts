/**
 * @file health.controller.ts
 * @description 健康检查控制器，用于 K8s/Docker 部署的存活和就绪探针
 * @pos 控制器层 - 提供健康检查端点
 */
import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('ready')
  ready() {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    }
  }
}
