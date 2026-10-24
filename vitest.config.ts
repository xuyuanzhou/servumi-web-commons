import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const commonsVersion: string = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

/**
 * 纯逻辑单测：只跑 `src` 下的 `*.test.ts`。
 * 本包没有页面与构建插件，单测环境与消费方一致地用 node（请求走到 fetch，由用例替身接管）。
 *
 * 注入 `__COMMONS_VERSION__` 与消费方构建时的做法一致：本包产不出这个常量，
 * 版本只能由打包方注入（见 `src/contract-version.ts`），单测也照这条路走，
 * 否则契约版本比对那一段在测试里永远是「未知版本」而跑不到。
 */
export default defineConfig({
  define: {
    __COMMONS_VERSION__: JSON.stringify(commonsVersion),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
