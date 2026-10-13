import antfu from '@antfu/eslint-config'

export default antfu(
  {
    vue: false,
    jsx: true,
    typescript: true,
    markdown: false,
    formatters: {
      css: true,
      html: true,
    },
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.md',
      'lint_output.txt',
      'server_errors.txt',
      'web_errors.txt',
    ],
  },
  {
    rules: {
      'no-console': 'warn',
      'antfu/if-newline': 'off',
    },
  },
  {
    files: ['apps/server/**/*.ts'],
    rules: {
      'ts/consistent-type-imports': 'off',
    },
  },
)
