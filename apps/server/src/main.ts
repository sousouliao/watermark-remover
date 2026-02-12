/**
 * @file main.ts
 * @description 应用入口点，负责启动 NestJS 应用，配置 CORS、请求体解析器和全局 API 前缀
 * @pos 应用入口点 - 服务器启动时第一个执行的文件
 */
import process from 'node:process'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import express from 'express'
import { AppModule } from './app.module'

async function bootstrap() {
  // 禁用默认 body parser（默认限制 100KB），后面手动注册 50mb 限制
  const app = await NestFactory.create(AppModule, { bodyParser: false })

  // 启用全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // 启用 CORS 以支持跨域请求
  app.enableCors()

  // 注册 50mb 限制的 body parser，用于处理 Base64 图片
  const expressApp = app.getHttpAdapter().getInstance() as express.Application
  expressApp.use(express.json({ limit: '50mb' }))
  expressApp.use(express.urlencoded({ limit: '50mb', extended: true }))

  // 设置全局 API 前缀
  app.setGlobalPrefix('api')

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
