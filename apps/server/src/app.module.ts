/**
 * @file app.module.ts
 * @description 根应用模块，负责编排所有功能模块和核心应用组件
 * @pos 根模块 - 依赖注入的入口点，聚合所有功能模块
 */
import { join } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { HealthController } from './health/health.controller'
import { WatermarkModule } from './watermark/watermark.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // 生产环境：前端构建产物在 dist/web，根路径 / 返回 SPA，/api 走接口
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'web'),
      exclude: ['/api/(.*)'],
    }),
    WatermarkModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
