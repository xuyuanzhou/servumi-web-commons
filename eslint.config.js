// 前端规则基线：ESLint 只管语言正确性，行内格式全部交给 Prettier，
// 两者重叠的规则由 eslint-config-prettier 关闭，避免同一处报两次。
// 本包只有模块标准页面骨架这一处 React 代码，插件只为它装载，别处仍按纯 TS 检查。
import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // .history 是编辑器本地历史副本，@mf-types 是 Federation 构建期生成的类型产物：两者都不参与门禁。
  { ignores: ['dist', 'coverage', '.history', '@mf-types'] },
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
    // 标准页面骨架跑在浏览器里；本包其余部分是框架无关的纯 TS 或 Node 侧工具。
    files: ['src/**/*.tsx'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      // 缺依赖多为真问题，但补依赖有时会改变取数时序，故留 warning，
      // 由 `lint` 的 --max-warnings=0 逼出「要么补，要么写明抑制原因」。
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // 本包在浏览器与 Node（测试）里都要能跑，两者都提供 fetch 与 Response。
    files: ['src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  eslintConfigPrettier,
)
