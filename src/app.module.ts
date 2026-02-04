/**
 * @file app.module.ts
 * @description 根应用模块，负责编排所有功能模块和核心应用组件
 * @input AppController, AppService, WatermarkModule
 * @output AppModule (导出的类)
 * @pos 根模块 - 依赖注入的入口点，聚合所有功能模块
 */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WatermarkModule } from './watermark/watermark.module';

@Module({
  imports: [WatermarkModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
