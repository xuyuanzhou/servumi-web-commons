/**
 * 取句的全局入口：让非组件代码（列定义、错误格式化、工具函数）也能直接取句，
 * 不必把 `formatMessage` 一路当参数透传。
 *
 * 登记只发生在渲染边界——壳的 `LocaleProvider`、Remote 的 `ModuleLayout`——因此有两条约束：
 * 只能在函数体或渲染期调用；不能在模块顶层常量里求值，那时登记尚未发生，只会拿到键名。
 * 页面的 `formatMessage` 入参仍然保留：显式传参是可测可推断的主路径，全局入口是辅助代码的出口，
 * 组件内后者会被前者遮蔽，两者取到的都是当前取句。
 *
 * commons 未进 Module Federation 的共享表，各应用包各持一份本模块实例，故这里的「全局」
 * 是包内全局：壳登记壳的，每个 Remote 登记自己的，互不干扰。
 */
import type { Translator } from './contract'
import { FALLBACK_LANG } from './locale'

let registered: Translator | null = null
let registeredLocale: string = FALLBACK_LANG

/** 渲染边界登记当前取句与有效目录；重复登记以最后一次为准。 */
export function registerLocale(translator: Translator, locale: string): void {
  registered = translator
  registeredLocale = locale
}

/**
 * 按点分键取当前语言的文案。登记前只回键名——与目录缺键的回退口径一致，
 * 宁可让漏配的键显形，也不返回空白。
 */
export function formatMessage(key: string, values?: Record<string, string | number>): string {
  return registered === null ? key : registered(key, values)
}

/** 当前有效目录标签，小写地区如 zh-cn；登记前为源语言。 */
export function currentLocale(): string {
  return registeredLocale
}

/** 单测复位用；生产代码不调用——登记随渲染边界走，不需要清。 */
export function resetLocale(): void {
  registered = null
  registeredLocale = FALLBACK_LANG
}
