/**
 * @file app.module.ts
 * @description 根应用模块，负责编排所有功能模块和核心应用组件
 * @pos 根模块 - 依赖注入的入口点，聚合所有功能模块
 */
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { HealthController } from './health/health.controller'
import { WatermarkModule } from './watermark/watermark.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WatermarkModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
