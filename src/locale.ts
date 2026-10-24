/**
 * 界面语言的选择：标签规范化、目录协商、文案取值与取句函数。
 *
 * 这层属于前端基座能力：壳与各 Remote 都要按同一套语义处理目录、回退与插值，
 * 否则同一份 module 自述和同一条文案键会在装配态与独立运行态表现出两套口径。
 */
import type { Translator } from './contract'

/** 默认语言也是源语言：只发布简体时，缺译文一律回退到这里。 */
export const FALLBACK_LANG = 'zh-cn'

/** 一份随客户端编译的界面语言包。 */
export type LocaleBundle = {
  /** 目录标签，小写地区，例如 zh-cn。 */
  lang: string
  /** 给用户看的名称，例如「简体中文」；菜单里不显示标签本身。 */
  name: string
  /** 书写方向；默认 ltr。 */
  dir: 'ltr' | 'rtl'
  /** 点分键 → 文案。模块目录在此处已由装配方补上模块前缀，例如 learn-lesson.title。 */
  messages: Record<string, string>
}

const TAG_PATTERN = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/

/**
 * 标签归一：去空白、按合法标签校验后转小写。不做 BCP 47 规范大小写——
 * 本平台的目录名是小写地区（zh-cn），若按 `Intl.getCanonicalLocales` 转成 zh-CN，反而与目录名对不上。
 */
export function normalizeTag(raw: string): string | null {
  const value = raw.trim()
  if (value === '' || !TAG_PATTERN.test(value)) {
    return null
  }
  return value.toLowerCase()
}

/**
 * 一个偏好标签的候选目录标签，从最具体到最通用：`zh-CN` → ["zh-cn", "zh"]，`en` → ["en"]。
 * 只按语言与地区回退，不做字形推断。
 */
export function candidateTags(raw: string): string[] {
  const tag = normalizeTag(raw)
  if (tag === null) {
    return []
  }
  const [language] = tag.split('-')
  return language === tag ? [tag] : [tag, language]
}

/** 按偏好顺序匹配已发布目录；都不匹配时返回 fallback。 */
export function negotiate(
  preferences: readonly string[],
  published: readonly string[],
  fallback: string = FALLBACK_LANG,
): string {
  for (const preference of preferences) {
    for (const candidate of candidateTags(preference)) {
      const hit = published.find((lang) => lang.toLowerCase() === candidate.toLowerCase())
      if (hit) {
        return hit
      }
    }
  }
  return fallback
}

/** 取有效目录；目录缺失时回退到源语言目录，保证界面不空白。 */
export function selectLocaleBundle(
  localeBundles: readonly LocaleBundle[],
  effective: string,
  fallback: string = FALLBACK_LANG,
): LocaleBundle {
  const localeBundle =
    localeBundles.find((item) => item.lang === effective) ?? localeBundles.find((item) => item.lang === fallback)
  if (!localeBundle) {
    throw new Error('至少要有源语言目录')
  }
  return localeBundle
}

/**
 * 从语言对象里取展示文案，例如 module.json 的 title；缺译文回退源语言，再退回第一条。
 * 标签比较忽略大小写，故 `zh-CN` 与目录名 `zh-cn` 不会因为写法不同而取空。
 * 接受空值：服务端返回的富文本字段可以缺省（如登记信息里的 title），调用点因此不必各写一遍判空。
 */
export function readLocalizedText(
  text: Record<string, string> | null | undefined,
  effective: string,
  fallback: string = FALLBACK_LANG,
): string {
  if (!text) {
    return ''
  }
  const direct = matchTag(text, effective)
  if (direct !== undefined) {
    return direct
  }
  const fallbackHit = matchTag(text, fallback)
  if (fallbackHit !== undefined) {
    return fallbackHit
  }
  return Object.values(text)[0] ?? ''
}

/** 按标签取一条译文，先精确后忽略大小写；都没有返回 undefined。 */
function matchTag(text: Record<string, string>, tag: string): string | undefined {
  if (Object.hasOwn(text, tag)) {
    return text[tag]
  }
  const lower = tag.toLowerCase()
  const key = Object.keys(text).find((candidate) => candidate.toLowerCase() === lower)
  return key === undefined ? undefined : text[key]
}

/** 嵌套目录：值是文案，或是更深一层的目录。模块 JSON 写这种形状，不写点分键。 */
export type NestedMessages = { [key: string]: string | NestedMessages }

/**
 * 把嵌套目录展平成点分键：`{ manage: { fact: { domain: "业务域" } } }` → `{ "manage.fact.domain": "业务域" }`。
 * 只按对象层级拼键，不解析键名里已含的点；非字符串的叶子节点忽略，不在加载期抛错。
 */
export function flattenLocaleMessages(messages: NestedMessages, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix === '' ? key : `${prefix}.${key}`
    if (typeof value === 'string') {
      out[path] = value
    } else if (value !== null && typeof value === 'object') {
      Object.assign(out, flattenLocaleMessages(value, path))
    }
  }
  return out
}

/**
 * 给一份模块相对目录补上模块命名空间，得到装配后的全局键。
 * 模块因此不在自己的 JSON 与调用点里重复模块 id，前缀只在装配边界产生一次。
 */
export function namespaceLocaleMessages(messages: Record<string, string>, scope: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(messages)) {
    out[`${scope}.${key}`] = value
  }
  return out
}

/** 取句子：有效目录 → 源语言目录 → 键名。 */
export function messageOf(localeBundle: LocaleBundle, fallbackLocaleBundle: LocaleBundle, key: string): string {
  return localeBundle.messages[key] ?? fallbackLocaleBundle.messages[key] ?? key
}

/**
 * 参数插值：`{name}` 占位，以及 ICU 的 `plural` / `select` 两种选择形式。
 * 复数类别由 `Intl.PluralRules` 按标签给出，不自己写语言判断——即 CLDR 的口径；
 * 源语言 `zh-cn` 只有 `other` 一类，故现在的中文句子仍可只写 `other`。
 * 解析失败一律回退成原样输出，不抛错、不返回空白。
 */
export function interpolate(
  pattern: string,
  values?: Record<string, string | number>,
  lang: string = FALLBACK_LANG,
): string {
  if (!values) {
    return pattern
  }
  return render(pattern, values, lang, 0)
}

/** 递归深度上限：挡住自引用造成的无限展开。 */
const MAX_DEPTH = 5

function render(pattern: string, values: Record<string, string | number>, lang: string, depth: number): string {
  if (depth > MAX_DEPTH) {
    return pattern
  }
  let result = ''
  let index = 0
  while (index < pattern.length) {
    const char = pattern[index]
    if (char !== '{') {
      result += char
      index += 1
      continue
    }
    const end = matchBrace(pattern, index)
    if (end === -1) {
      result += char
      index += 1
      continue
    }
    result += renderArgument(pattern.slice(index + 1, end), values, lang, depth)
    index = end + 1
  }
  return result
}

/** 与 `start` 处的 `{` 配对的 `}` 下标；不配对返回 -1。 */
function matchBrace(pattern: string, start: number): number {
  let depth = 0
  for (let index = start; index < pattern.length; index += 1) {
    if (pattern[index] === '{') {
      depth += 1
    } else if (pattern[index] === '}') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }
  return -1
}

/** 在花括号深度为 0 的逗号处切分，使选项体内的逗号不被当作分隔符。 */
function splitTopLevel(text: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0
  for (const char of text) {
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
    } else if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)
  return parts
}

/** 解析 `one {…} other {…}` 形式的选项表；键可含 `=0` 这类精确值。 */
function parseOptions(text: string): Map<string, string> {
  const options = new Map<string, string>()
  let index = 0
  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index])) {
      index += 1
    }
    if (index >= text.length || text[index] !== '{') {
      let key = ''
      while (index < text.length && text[index] !== '{') {
        key += text[index]
        index += 1
      }
      const end = matchBrace(text, index)
      if (end === -1) {
        break
      }
      options.set(key.trim(), text.slice(index + 1, end))
      index = end + 1
      continue
    }
    break
  }
  return options
}

function renderArgument(inner: string, values: Record<string, string | number>, lang: string, depth: number): string {
  const parts = splitTopLevel(inner)
  const name = (parts[0] ?? '').trim()
  const type = (parts[1] ?? '').trim()
  if (parts.length < 2 || (type !== 'plural' && type !== 'select')) {
    return name in values ? String(values[name]) : `{${inner}}`
  }

  const options = parseOptions(parts.slice(2).join(','))
  const raw = values[name]
  if (type === 'select') {
    const branch = options.get(String(raw)) ?? options.get('other')
    return branch === undefined ? `{${inner}}` : render(branch, values, lang, depth + 1)
  }

  const count = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(count)) {
    return `{${inner}}`
  }
  const branch = options.get(`=${count}`) ?? options.get(pluralCategory(lang, count)) ?? options.get('other')
  if (branch === undefined) {
    return `{${inner}}`
  }
  return render(branch, values, lang, depth + 1).replace(/#/g, new Intl.NumberFormat(lang).format(count))
}

/** CLDR 复数类别；标签不受支持时退化为 one/other。 */
function pluralCategory(lang: string, count: number): string {
  try {
    return new Intl.PluralRules(lang).select(count)
  } catch {
    return count === 1 ? 'one' : 'other'
  }
}

/** 把目录与偏好绑成取句函数；同一份目录可被壳或模块复用。 */
export function createLocaleTranslator(
  localeBundles: readonly LocaleBundle[],
  effective: string,
  fallback: string = FALLBACK_LANG,
): Translator {
  const localeBundle = selectLocaleBundle(localeBundles, effective, fallback)
  const fallbackLocaleBundle = selectLocaleBundle(localeBundles, fallback, fallback)
  return (key, values) => interpolate(messageOf(localeBundle, fallbackLocaleBundle, key), values, localeBundle.lang)
}

/** 把一份目录绑成取句函数；缺键回退键名。 */
export function createTranslator(messages: Record<string, string>): Translator {
  return (key, values) => interpolate(messages[key] ?? key, values)
}

/** 展示服务端返回的 epoch 毫秒时间戳；地区格式随有效目录，时区用浏览器当前时区。 */
export function formatWhen(epochMs: number, lang: string): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return ''
  }
  try {
    return new Intl.DateTimeFormat(lang, {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(epochMs))
  } catch {
    return ''
  }
}
