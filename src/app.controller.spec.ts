/**
 * @file app.controller.spec.ts
 * @description AppController 的单元测试
 * @input AppController, AppService, TestingModule from @nestjs/testing
 * @output AppController 的测试套件
 * @pos 测试文件 - 验证 AppController 的功能
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
