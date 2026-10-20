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
 * 键前缀必须由调用方传入（如 `learn-lesson`）：目录键是模块私有的，公共包猜不出来。
 * 目录缺该码时回退服务端 message，两条路径都不把原始 message 当成已翻译文案吞掉。
 */
export function createFormatError(keyPrefix: string): (error: unknown, t: Translator) => string {
  return (error, t) => {
    const apiError = asApiError(error)
    if (apiError) {
      const key = `${keyPrefix}.error.${apiError.code}`
      const known = t(key)
      const message = known === key ? apiError.message || apiError.code : known
      return t(`${keyPrefix}.error.detail`, { message, code: apiError.code, requestId: apiError.requestId })
    }
    if (error instanceof Error) {
      return error.message || t(`${keyPrefix}.error.unknown`)
    }
    return t(`${keyPrefix}.error.unknown`)
  }
}
