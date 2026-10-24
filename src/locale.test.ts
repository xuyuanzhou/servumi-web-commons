import { describe, expect, it } from 'vitest'
import {
  type LocaleBundle,
  candidateTags,
  flattenLocaleMessages,
  interpolate,
  messageOf,
  negotiate,
  namespaceLocaleMessages,
  normalizeTag,
  readLocalizedText,
  selectLocaleBundle,
} from './locale'

const LOCALE_BUNDLES: LocaleBundle[] = [
  { lang: 'zh-cn', name: '简体中文', dir: 'ltr', messages: { 'shell.login': '登录' } },
  { lang: 'en', name: 'English', dir: 'ltr', messages: { 'shell.login': 'Sign in' } },
]

describe('normalizeTag', () => {
  it('归一为小写，不按 BCP 47 规范大小写', () => {
    expect(normalizeTag('zh-cn')).toBe('zh-cn')
    expect(normalizeTag('EN-us')).toBe('en-us')
    expect(normalizeTag('ZH-cn')).toBe('zh-cn')
  })

  it('去掉首尾空白', () => {
    expect(normalizeTag('  zh-cn  ')).toBe('zh-cn')
  })

  it('无效标签返回 null，不拿去匹配目录', () => {
    expect(normalizeTag('')).toBeNull()
    expect(normalizeTag('123')).toBeNull()
    expect(normalizeTag('zh_cn')).toBeNull()
    expect(normalizeTag('e')).toBeNull()
  })
})

describe('candidateTags', () => {
  it('按语言与地区回退，从最具体到最通用', () => {
    expect(candidateTags('zh-CN')).toEqual(['zh-cn', 'zh'])
    expect(candidateTags('zh-TW')).toEqual(['zh-tw', 'zh'])
    expect(candidateTags('en-US')).toEqual(['en-us', 'en'])
  })

  it('只有语言时没有更通用的候选', () => {
    expect(candidateTags('zh')).toEqual(['zh'])
    expect(candidateTags('en')).toEqual(['en'])
  })

  it('无效标签没有候选', () => {
    expect(candidateTags('')).toEqual([])
    expect(candidateTags('zh_cn')).toEqual([])
  })
})

describe('negotiate', () => {
  it('偏好 zh-CN 命中已发布目录 zh-cn', () => {
    expect(negotiate(['zh-CN'], ['zh-cn', 'en'])).toBe('zh-cn')
  })

  it('按偏好顺序先命中先返回', () => {
    expect(negotiate(['en-US', 'zh-CN'], ['zh-cn', 'en'])).toBe('en')
  })

  it('匹配大小写不敏感，返回已发布目录的原样标签', () => {
    expect(negotiate(['ZH-cn'], ['zh-cn'])).toBe('zh-cn')
  })

  it('都不匹配时回退到源语言', () => {
    expect(negotiate(['fr'], ['zh-cn'], 'zh-cn')).toBe('zh-cn')
    expect(negotiate([''], ['zh-cn'], 'zh-cn')).toBe('zh-cn')
  })
})

describe('selectLocaleBundle / readLocalizedText', () => {
  it('有效目录缺失时回退到源语言目录', () => {
    expect(selectLocaleBundle(LOCALE_BUNDLES, 'en').lang).toBe('en')
    expect(selectLocaleBundle(LOCALE_BUNDLES, 'ja').lang).toBe('zh-cn')
  })

  it('文案缺译文时回退源语言，再退到首个可用值', () => {
    expect(readLocalizedText({ en: 'Notes', 'zh-cn': '笔记' }, 'en')).toBe('Notes')
    expect(readLocalizedText({ 'zh-cn': '笔记' }, 'en')).toBe('笔记')
    expect(readLocalizedText({}, 'en')).toBe('')
  })

  it('标签比较忽略大小写', () => {
    expect(readLocalizedText({ 'zh-cn': '笔记' }, 'zh-CN')).toBe('笔记')
    expect(readLocalizedText({ 'ZH-CN': '笔记' }, 'zh-cn')).toBe('笔记')
  })
})

describe('flattenLocaleMessages / namespaceLocaleMessages', () => {
  it('嵌套目录展平成点分键，只按层级不解析键名里的点', () => {
    expect(flattenLocaleMessages({ manage: { fact: { domain: '业务域' } }, title: '课文' })).toEqual({
      'manage.fact.domain': '业务域',
      title: '课文',
    })
    expect(flattenLocaleMessages({ 'a.b': 'X' })).toEqual({ 'a.b': 'X' })
  })

  it('非字符串叶子忽略，不抛错', () => {
    expect(flattenLocaleMessages({ ok: '文案', bad: 1 as unknown as string })).toEqual({ ok: '文案' })
  })

  it('补命名空间只加一层模块前缀', () => {
    expect(namespaceLocaleMessages({ 'manage.fact.domain': '业务域' }, 'learn-lesson')).toEqual({
      'learn-lesson.manage.fact.domain': '业务域',
    })
  })
})

describe('messageOf / interpolate', () => {
  const zh = LOCALE_BUNDLES[0]
  const en = LOCALE_BUNDLES[1]

  it('有效目录缺键时回退源语言目录，再退到键名', () => {
    expect(messageOf(en, zh, 'shell.login')).toBe('Sign in')
    expect(messageOf(zh, zh, 'shell.login')).toBe('登录')
    expect(messageOf(en, zh, 'shell.missing')).toBe('shell.missing')
  })

  it('{name} 插值替换；缺值时保留占位符', () => {
    expect(interpolate('共 {total} 条', { total: 3 })).toBe('共 3 条')
    expect(interpolate('共 {total} 条')).toBe('共 {total} 条')
    expect(interpolate('共 {total} 条', { other: 1 })).toBe('共 {total} 条')
  })

  it('plural 按 CLDR 类别选分支，`#` 换成按标签格式化的数量', () => {
    const pattern = '{count, plural, one {# item} other {# items}}'
    expect(interpolate(pattern, { count: 1 }, 'en')).toBe('1 item')
    expect(interpolate(pattern, { count: 3 }, 'en')).toBe('3 items')
    expect(interpolate('{count, plural, one {一} other {共 # 项}}', { count: 1 }, 'zh-cn')).toBe('共 1 项')
  })

  it('plural 支持 `=N` 精确分支，且优先于类别', () => {
    const pattern = '{count, plural, =0 {没有} other {# 项}}'
    expect(interpolate(pattern, { count: 0 }, 'en')).toBe('没有')
    expect(interpolate(pattern, { count: 2 }, 'en')).toBe('2 项')
  })

  it('select 按取值选分支，落空回退 other', () => {
    const pattern = '{gender, select, male {他} female {她} other {TA}}'
    expect(interpolate(pattern, { gender: 'male' }, 'zh-cn')).toBe('他')
    expect(interpolate(pattern, { gender: 'unknown' }, 'zh-cn')).toBe('TA')
  })

  it('分支体内可再插值；无法解析时原样输出', () => {
    expect(interpolate('{n, plural, other {#/{total}}}', { n: 2, total: 5 }, 'en')).toBe('2/5')
    expect(interpolate('{n, plural, one {一}}', { n: 4 }, 'en')).toBe('{n, plural, one {一}}')
    expect(interpolate('{n, plural, other {#}}', { n: '多' }, 'en')).toBe('{n, plural, other {#}}')
    expect(interpolate('半个花括号 {', { a: 1 })).toBe('半个花括号 {')
  })
})
