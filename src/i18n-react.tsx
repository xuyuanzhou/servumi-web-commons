import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import type { Translator } from './contract'
import { FALLBACK_LANG, createLocaleTranslator, negotiate, selectLocaleBundle, type LocaleBundle } from './locale'
import { registerLocale } from './locale-runtime'

/** 壳与模块共用的界面语言上下文；只放取值，不含目录装配之外的业务状态。 */
export type LocaleContextValue = {
  /** 有效目录标签，小写地区如 zh-cn；也是 `<html lang>` 与 Accept-Language` 的取值。 */
  locale: string
  /** 有效目录的人话名称，如「简体中文」；菜单里显示它，不显示标签本身。 */
  localeName: string
  /** 按点分键读取文案。 */
  formatMessage: Translator
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext)
  if (!value) {
    throw new Error('useLocale 必须在 LocaleProvider 内使用')
  }
  return value
}

/** 浏览器语言偏好，按用户排序；没有时返回空表，交由回退处理。 */
export function browserPreferences(): string[] {
  if (typeof navigator === 'undefined') {
    return []
  }
  if (navigator.languages && navigator.languages.length > 0) {
    return [...navigator.languages]
  }
  return navigator.language ? [navigator.language] : []
}

/** 更易懂的主名：读取浏览器语言偏好。 */
export function readBrowserLocales(): string[] {
  return browserPreferences()
}

export type LocaleProviderProps = {
  localeBundles: readonly LocaleBundle[]
  publishedLocales?: readonly string[]
  sessionLocale?: string | null
  browserLocales?: () => string[]
  setAcceptLanguage?: (locale: string | null) => void
  children: ReactNode
}

/**
 * 基座级语言 Provider：协商有效目录，并把它绑定到 `<html lang|dir>` 与 Accept-Language。
 * 壳与调试态 Remote 都可复用这一层，只需各自提供已发布目录清单与会话语言偏好。
 */
export function LocaleProvider({
  localeBundles,
  publishedLocales,
  sessionLocale,
  browserLocales = browserPreferences,
  setAcceptLanguage,
  children,
}: LocaleProviderProps) {
  const preferences = sessionLocale ? [sessionLocale, ...browserLocales()] : browserLocales()
  const supported = publishedLocales ?? localeBundles.map((item) => item.lang)
  const locale = negotiate(preferences, supported, FALLBACK_LANG)
  const localeBundle = selectLocaleBundle(localeBundles, locale, FALLBACK_LANG)
  const formatMessage = useMemo(
    () => createLocaleTranslator(localeBundles, localeBundle.lang, FALLBACK_LANG),
    [localeBundles, localeBundle.lang],
  )

  // 同步登记到全局取句。放在渲染体而不是 effect：子组件先于父组件的 effect 渲染，
  // 树里任何在渲染期取句的辅助代码（列定义、错误格式化）只有此时才拿得到当前取句。
  registerLocale(formatMessage, localeBundle.lang)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.lang = localeBundle.lang
      root.dir = localeBundle.dir
    }
    setAcceptLanguage?.(localeBundle.lang)
  }, [localeBundle.dir, localeBundle.lang, setAcceptLanguage])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale: localeBundle.lang,
      localeName: localeBundle.name,
      formatMessage,
    }),
    [localeBundle.lang, localeBundle.name, formatMessage],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
