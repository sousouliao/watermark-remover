import type { UserConfig } from '@commitlint/types';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 提交类型枚举
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修复 bug
        'docs', // 文档变更
        'style', // 代码格式（不影响代码运行的变动）
        'refactor', // 重构（既不是新增功能，也不是修复 bug）
        'perf', // 性能优化
        'test', // 增加测试
        'chore', // 构建过程或辅助工具的变动
        'ci', // CI 配置文件和脚本的变更
        'revert', // 回滚提交
        'build', // 构建系统或外部依赖的变更
      ],
    ],
    // 类型必须小写
    'type-case': [2, 'always', 'lower-case'],
    // 类型不能为空
    'type-empty': [2, 'never'],
    // 主题不能为空
    'subject-empty': [2, 'never'],
    // 主题不能以句号结尾
    'subject-full-stop': [2, 'never', '.'],
    // 主题不能使用大写
    'subject-case': [2, 'never', ['upper-case']],
    // 主题最大长度
    'subject-max-length': [2, 'always', 100],
    // 主题最小长度
    'subject-min-length': [2, 'always', 10],
    // 头部最大长度
    'header-max-length': [2, 'always', 100],
    // 正文每行最大长度
    'body-max-line-length': [2, 'always', 100],
  },
};

export default config;
