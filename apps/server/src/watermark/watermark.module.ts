/**
 * @file watermark.module.ts
 * @description 注册水印移除功能的模块 (控制器和服务)
 * @input WatermarkController, WatermarkService
 * @output WatermarkModule (导出的类)
 * @pos 功能模块 - 封装水印移除功能以供依赖注入使用
 */
import { Module } from '@nestjs/common'
import { WatermarkController } from './watermark.controller'
import { WatermarkService } from './watermark.service'

@Module({
  controllers: [WatermarkController],
  providers: [WatermarkService],
})
export class WatermarkModule {}
