/**
 * @file upscale.module.ts
 * @description 注册图像画质增强功能的模块 (控制器和服务)
 * @pos 功能模块 - 封装画质增强功能以供依赖注入使用
 */
import { Module } from '@nestjs/common'
import { UpscaleController } from './upscale.controller'
import { UpscaleService } from './upscale.service'

@Module({
  controllers: [UpscaleController],
  providers: [UpscaleService],
  exports: [UpscaleService],
})
export class UpscaleModule {}
