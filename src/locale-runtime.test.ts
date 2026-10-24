import { beforeEach, describe, expect, it } from 'vitest'
import { FALLBACK_LANG, createTranslator } from './locale'
import { currentLocale, formatMessage, registerLocale, resetLocale } from './locale-runtime'

describe('全局取句', () => {
  beforeEach(() => {
    resetLocale()
  })

  it('登记前只回键名，目录与语言都是源语言', () => {
    expect(formatMessage('manage.fact.domain')).toBe('manage.fact.domain')
    expect(formatMessage('manage.heading', { title: '进度' })).toBe('manage.heading')
    expect(currentLocale()).toBe(FALLBACK_LANG)
  })

  it('登记后按目录取句，插值用登记时的语言', () => {
    registerLocale(createTranslator({ 'manage.heading': '{title} · 管理' }), 'zh-cn')
    expect(formatMessage('manage.heading', { title: '进度' })).toBe('进度 · 管理')
    expect(currentLocale()).toBe('zh-cn')
  })

  it('缺键仍回退键名，不返回空白', () => {
    registerLocale(createTranslator({ 'manage.heading': '管理' }), 'zh-cn')
    expect(formatMessage('manage.note')).toBe('manage.note')
  })

  it('重复登记以最后一次为准', () => {
    registerLocale(createTranslator({ title: '课文' }), 'zh-cn')
    registerLocale(createTranslator({ title: 'Lesson' }), 'en')
    expect(formatMessage('title')).toBe('Lesson')
    expect(currentLocale()).toBe('en')
  })
})
