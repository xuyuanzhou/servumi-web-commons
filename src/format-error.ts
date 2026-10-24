import type { Translator } from './contract'

type ApiErrorLike = { status: number; code: string; message: string; requestId: string }

function asApiError(error: unknown): ApiErrorLike | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }
  const candidate = error as Record<string, unknown>
  if (typeof candidate.status !== 'number' || typeof candidate.code !== 'string') {
    return null
  }
  return {
    status: candidate.status,
    code: candidate.code,
    message: typeof candidate.message === 'string' ? candidate.message : '',
    requestId: typeof candidate.requestId === 'string' ? candidate.requestId : '',
  }
}

/**
 * 取接口错误的业务码；非接口错误返回 null。
 *
 * 用结构判定而不是 `instanceof ApiError`：装配运行时抛的是壳那份 ApiError 实例，
 * 独立运行时抛的是本包这份，类标识不同，只有 shape 是两边都成立的事实。
 */
export function errorCode(error: unknown): string | null {
  const apiError = asApiError(error)
  return apiError ? apiError.code : null
}

/**
 * 取接口错误的 HTTP 状态码；非接口错误返回 null。
 * 守卫页据此把「服务端说没有权限」（403）与「问不到结果」（网络/5xx）分开呈现。
 */
export function errorStatus(error: unknown): number | null {
  const apiError = asApiError(error)
  return apiError ? apiError.status : null
}

/**
 * 造一个用本模块语言目录取句的错误文案函数。
 *
 * `keyPrefix` 是传进来的 `formatMessage` 背后目录已经带的键前缀：壳取自己的目录时传 `shell`；
 * 模块拿到的是壳按模块 id 限定过作用域的 `formatMessage`，键本身就是模块内相对键，不传前缀即可。
 * 目录缺该码时回退服务端 message，两条路径都不把原始 message 当成已翻译文案吞掉。
 */
export function createFormatError(keyPrefix = ''): (error: unknown, formatMessage: Translator) => string {
  const at = (suffix: string) => (keyPrefix === '' ? suffix : `${keyPrefix}.${suffix}`)

  return (error, formatMessage) => {
    const apiError = asApiError(error)
    if (apiError) {
      const codeKey = at(`error.${apiError.code}`)
      const known = formatMessage(codeKey)
      const message = known === codeKey ? apiError.message || apiError.code : known
      return formatMessage(at('error.detail'), { message, code: apiError.code, requestId: apiError.requestId })
    }
    if (error instanceof Error) {
      return error.message || formatMessage(at('error.unknown'))
    }
    return formatMessage(at('error.unknown'))
  }
}
