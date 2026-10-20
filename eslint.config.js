// 前端规则基线：ESLint 只管语言正确性，行内格式全部交给 Prettier，
// 两者重叠的规则由 eslint-config-prettier 关闭，避免同一处报两次。
// 本包不含 React 页面，故不装 react-hooks 插件；消费方（壳与各 Remote）的副本仍保留它。
import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // .history 是编辑器本地历史副本，不参与门禁。
  { ignores: ['dist', 'coverage', '.history'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // 相等判断必须写全，`== null` 例外：它同时判 null 与 undefined，是刻意的写法。
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // 非空断言在本仓是刻意的：信封校验通过后 data 的取值点明确，改成可选链会把
      // 「服务端契约破了」静默成 undefined，反而更难查。
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // 本包在浏览器与 Node（测试）里都要能跑，两者都提供 fetch 与 Response。
    files: ['src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  eslintConfigPrettier,
)
