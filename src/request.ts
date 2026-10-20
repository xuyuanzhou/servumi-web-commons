import type { ShellRequest } from './contract'
import { parseEnvelope, type ApiEnvelope } from './envelope'
import { ApiError } from './error'

export type RequestOptions = {
  method?: string
  body?: unknown
  /** 默认带令牌；匿名端点（登录、注册）显式传 false。 */
  auth?: boolean
  /** 默认在 401 时先试一次静默刷新再重放；重放自身必须传 false，否则会自激。 */
  retry?: boolean
}

export type RefreshResult = {
  ok: boolean
  /** 身份服务不可达或其 5xx：调用方应呈现「暂时问不到」，不要把用户当作已退出。 */
  unavailable: boolean
}

export type ApiClient = {
  request: ShellRequest
  /** 用刷新令牌换访问令牌；壳与 Remote 的各调用点共用同一次在途请求。 */
  refresh: () => Promise<RefreshResult>
  getAccessToken: () => string | null
  setAccessToken: (token: string | null) => void
  clearAccessToken: () => void
  /** 界面选定的有效目录标签；请求带它，让服务端知道客户端实际用的语言。 */
  setAcceptLanguage: (lang: string | null) => void
}

export type ApiClientOptions = {
  /** 身份服务前缀；静默刷新打的是 `<identityPrefix>/refresh`。 */
  identityPrefix?: string
}

const DEFAULT_IDENTITY_PREFIX = '/api/sys-identity/v1'

/**
 * 造一个请求客户端：信封解析、Bearer 令牌、401 静默刷新重放，口径全平台一致。
 *
 * 单实例而非模块级单例：壳与 Remote 各自打包本包，共用一份全局变量并不能让两边真正共享会话，
 * 反而会让「谁清了令牌」变得不可追。跨边界共享的只有服务端会话本身（cookie + 刷新令牌）。
 */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const identityPrefix = options.identityPrefix ?? DEFAULT_IDENTITY_PREFIX

  let accessToken: string | null = null
  let refreshInFlight: Promise<RefreshResult> | null = null
  let acceptLanguage: string | null = null
  /**
   * 会话世代：每次显式建立或清除会话都自增。在途刷新在结果落地前比对世代，
   * 使退出换号期间完成的那次刷新不会把旧账号的令牌复活回内存。
   */
  let sessionEpoch = 0

  function getAccessToken(): string | null {
    return accessToken
  }

  function clearAccessToken(): void {
    accessToken = null
    sessionEpoch += 1
  }

  function setAccessToken(token: string | null): void {
    accessToken = token
    sessionEpoch += 1
  }

  function setAcceptLanguage(lang: string | null): void {
    acceptLanguage = lang
  }

  async function refreshOnce(): Promise<RefreshResult> {
    if (refreshInFlight) {
      return refreshInFlight
    }
    const epoch = sessionEpoch
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${identityPrefix}/refresh`, {
          method: 'POST',
          headers: acceptLanguage ? { 'Accept-Language': acceptLanguage } : undefined,
          credentials: 'include',
        })
        if (epoch !== sessionEpoch) {
          return { ok: false, unavailable: false }
        }
        if (!response.ok) {
          clearAccessToken()
          return { ok: false, unavailable: response.status >= 500 }
        }
        const envelope = await parseEnvelope(response)
        if (epoch !== sessionEpoch) {
          return { ok: false, unavailable: false }
        }
        if (!envelope.success) {
          clearAccessToken()
          return { ok: false, unavailable: false }
        }
        const data = envelope.data as { accessToken?: string }
        if (!data.accessToken) {
          clearAccessToken()
          return { ok: false, unavailable: false }
        }
        setAccessToken(data.accessToken)
        return { ok: true, unavailable: false }
      } catch {
        return { ok: false, unavailable: true }
      }
    })().finally(() => {
      refreshInFlight = null
    })
    return refreshInFlight
  }

  async function request<T = unknown>(path: string, requestOptions: RequestOptions = {}): Promise<ApiEnvelope<T>> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (acceptLanguage) {
      headers['Accept-Language'] = acceptLanguage
    }
    if (requestOptions.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    if (requestOptions.auth !== false && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const response = await fetch(path, {
      method: requestOptions.method ?? (requestOptions.body === undefined ? 'GET' : 'POST'),
      headers,
      credentials: 'include',
      body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
    })

    if (response.status === 401 && requestOptions.auth !== false && requestOptions.retry !== false) {
      const refreshed = await refreshOnce()
      if (refreshed.ok) {
        return request<T>(path, { ...requestOptions, retry: false })
      }
    }

    const envelope = await parseEnvelope(response)
    if (!response.ok || !envelope.success) {
      throw new ApiError(response.status, envelope)
    }
    return envelope as ApiEnvelope<T>
  }

  return { request, refresh: refreshOnce, getAccessToken, setAccessToken, clearAccessToken, setAcceptLanguage }
}
