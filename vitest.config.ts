import { defineConfig } from 'vitest/config'

/**
 * 纯逻辑单测：只跑 `src` 下的 `*.test.ts`。
 * 本包没有页面与构建插件，单测环境与消费方一致地用 node（请求走到 fetch，由用例替身接管）。
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
