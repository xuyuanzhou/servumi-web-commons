import { describe, expect, it } from 'vitest'
import { definePortalModule, type LocaleModules, type PortalPage } from './contract'
import type { NestedMessages } from './locale'

const page: PortalPage = () => null

/** 造一份端目录扫描结果；键照 `import.meta.glob` 给出的样子写。 */
function scan(entries: Record<string, PortalPage>): Record<string, { default: PortalPage }> {
  return Object.fromEntries(Object.entries(entries).map(([file, component]) => [file, { default: component }]))
}

/** 造一份语言目录扫描结果；键照 `import.meta.glob('./locale/*.json')` 给出的样子写。 */
function scanLocales(entries: Record<string, NestedMessages>): LocaleModules {
  return Object.fromEntries(Object.entries(entries).map(([file, messages]) => [file, { default: messages }]))
}

describe('definePortalModule', () => {
  it('显式装配：原样收下槽位，并把语言目录展平成点分键', () => {
    const module = definePortalModule({
      manage: page,
      locales: { 'zh-cn': { manage: { title: '管理' } } },
    })

    expect(module.manage).toBe(page)
    expect(module.desktop).toBeUndefined()
    expect(module.getLocales?.('zh-cn')).toEqual({ 'manage.title': '管理' })
    // 目录里没有的语言回 null，由壳回退源语言。
    expect(module.getLocales?.('en-us')).toBeNull()
  })

  it('扫描式：端目录在即占槽位，不需要在模块根再列一遍端名册', () => {
    const module = definePortalModule(scan({ './manage/index.ts': page, './desktop/index.ts': page }), {
      locales: { 'zh-cn': { title: '示例' } },
    })

    expect(module.manage).toBe(page)
    expect(module.desktop).toBe(page)
    expect(module.mobile).toBeUndefined()
  })

  it('扫描式：只认第一段是槽位名的入口，api 等同形目录不混进槽位表', () => {
    const module = definePortalModule(scan({ './api/index.ts': page, './manage/index.ts': page }))

    expect(Object.keys(module)).toEqual(['manage', 'getLocales', 'commonsVersion'])
  })

  it('扫描式：一个端目录都没有时不产出任何槽位', () => {
    const module = definePortalModule(scan({ './api/index.ts': page }))

    expect(module.desktop).toBeUndefined()
    expect(module.manage).toBeUndefined()
    expect(module.mobile).toBeUndefined()
  })

  it('公开槽位默认复用对应私有端，显式传入可覆盖', () => {
    const scanned = definePortalModule(scan({ './desktop/index.ts': page, './mobile/index.ts': page }))
    expect(scanned.publicDesktop).toBe(page)
    expect(scanned.publicMobile).toBe(page)

    const custom: PortalPage = () => null
    const explicit = definePortalModule({ desktop: page, mobile: page, publicMobile: custom })
    expect(explicit.publicDesktop).toBe(page)
    expect(explicit.publicMobile).toBe(custom)
  })

  it('没有对应私有端时不凭空造公开槽位', () => {
    const module = definePortalModule(scan({ './manage/index.ts': page }))

    expect(module.publicDesktop).toBeUndefined()
    expect(module.publicMobile).toBeUndefined()
  })

  it('语言目录扫描式：按文件名取地区码，加一个语言不必改模块根', () => {
    const module = definePortalModule(scan({ './desktop/index.ts': page }), {
      locales: scanLocales({ './locale/zh-cn.json': { title: '示例' } }),
    })

    expect(module.getLocales?.('zh-cn')).toEqual({ title: '示例' })
    expect(module.getLocales?.('en-us')).toBeNull()
  })

  it('语言目录扫描式：多份语言包各归各的地区码，手写目录仍可混用', () => {
    const scanned = definePortalModule({
      locales: scanLocales({ './locale/zh-cn.json': { title: '示例' }, './locale/en-us.json': { title: 'Demo' } }),
    })
    expect(scanned.getLocales?.('en-us')).toEqual({ title: 'Demo' })

    const written = definePortalModule({ locales: { 'zh-cn': { title: '示例' } } })
    expect(written.getLocales?.('zh-cn')).toEqual({ title: '示例' })
  })
})
