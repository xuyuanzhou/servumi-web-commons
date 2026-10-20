import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from './request'

function envelope(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function ok(body: Record<string, unknown> = {}): Record<string, unknown> {
  return { success: true, code: 'OK', message: '', data: body, requestId: 'r-ok' }
}

function failed(code: string, message = '', status = 400): Response {
  return envelope({ success: false, code, message, data: null, requestId: 'r-fail' }, status)
}

/** 从调用参数里取请求路径；用例只关心路径，不关心具体 fetch 实现。 */
function pathOf(input: unknown): string {
  return String(input)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createApiClient 请求口径', () => {
  it('成功时原样返回信封', async () => {
    const fetchMock = vi.fn(async () => envelope(ok({ id: '1' })))
    vi.stubGlobal('fetch', fetchMock)

    const client = createApiClient()
    const result = await client.request<{ id: string }>('/api/personal-notes/v1/notes')

    expect(result.data.id).toBe('1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('success=false 抛 ApiError，带状态码、业务码与请求号', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => failed('RESOURCE_NOT_FOUND', '没有这条', 404)),
    )

    const client = createApiClient()
    await expect(client.request('/api/personal-notes/v1/notes/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
      requestId: 'r-fail',
    })
  })

  it('响应不是信封时立刻报错，不把 undefined 透到页面', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => envelope({ html: '502 Bad Gateway' })),
    )

    const client = createApiClient()
    await expect(client.request('/api/personal-notes/v1/notes')).rejects.toThrow('响应不是 Servumi 信封')
  })

  it('无 body 默认 GET，有 body 默认 POST 并带 JSON 头', async () => {
    const inits: (RequestInit | undefined)[] = []
    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      inits.push(init)
      return envelope(ok())
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = createApiClient()
    await client.request('/api/x/read')
    await client.request('/api/x/write', { body: { title: 't' } })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(inits[0]?.method).toBe('GET')
    expect(inits[1]?.method).toBe('POST')
    expect((inits[1]?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })
})

describe('createApiClient 静默刷新', () => {
  it('401 时先刷新再重放，重放用新令牌', async () => {
    const seen: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const path = pathOf(input)
        seen.push(path)
        if (path.endsWith('/refresh')) {
          return envelope(ok({ accessToken: 'fresh' }))
        }
        const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization
        return authorization === 'Bearer fresh' ? envelope(ok({ id: '1' })) : failed('AUTH_UNAUTHORIZED', '过期', 401)
      }),
    )

    const client = createApiClient()
    client.setAccessToken('stale')
    await expect(client.request('/api/x')).resolves.toMatchObject({ success: true })

    expect(seen.filter((path) => path.endsWith('/refresh'))).toHaveLength(1)
    expect(client.getAccessToken()).toBe('fresh')
  })

  it('刷新失败且身份服务 5xx 时报告依赖不可用，并把原 401 抛给调用方', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        pathOf(input).endsWith('/refresh')
          ? new Response('', { status: 503 })
          : failed('AUTH_UNAUTHORIZED', '过期', 401),
      ),
    )

    const client = createApiClient()
    client.setAccessToken('stale')

    await expect(client.refresh()).resolves.toEqual({ ok: false, unavailable: true })
    expect(client.getAccessToken()).toBeNull()
    await expect(client.request('/api/x')).rejects.toMatchObject({ status: 401 })
  })

  it('并发 401 共用同一次在途刷新，不放大成刷新风暴', async () => {
    let refreshStarts = 0
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const path = pathOf(input)
        if (path.endsWith('/refresh')) {
          refreshStarts += 1
          await gate
          return envelope(ok({ accessToken: 'fresh' }))
        }
        const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization
        return authorization === 'Bearer fresh' ? envelope(ok({ id: path })) : failed('AUTH_UNAUTHORIZED', '过期', 401)
      }),
    )

    const client = createApiClient()
    client.setAccessToken('stale')

    const both = Promise.all([client.request('/api/a'), client.request('/api/b')])
    // 让两个请求都走到 401 并挂到同一次刷新上，再放行刷新响应。
    await new Promise((resolve) => setTimeout(resolve, 0))
    release()

    await expect(both).resolves.toHaveLength(2)
    expect(refreshStarts).toBe(1)
  })

  it('403 不触发刷新：那是权限问题，不是令牌过期', async () => {
    const refresh = vi.fn(async () => envelope(ok({ accessToken: 'fresh' })))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        pathOf(input).endsWith('/refresh') ? refresh() : failed('AUTH_FORBIDDEN', '无权限', 403),
      ),
    )

    const client = createApiClient()
    client.setAccessToken('good')
    await expect(client.request('/api/x')).rejects.toMatchObject({ status: 403 })

    expect(refresh).not.toHaveBeenCalled()
  })

  it('匿名端点（auth:false）401 不触发刷新，也不带令牌', async () => {
    const refresh = vi.fn(async () => envelope(ok({ accessToken: 'fresh' })))
    const authorizationSeen: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (pathOf(input).endsWith('/refresh')) {
          return refresh()
        }
        authorizationSeen.push((init?.headers as Record<string, string> | undefined)?.Authorization)
        return failed('AUTH_UNAUTHORIZED', '账号或密码不对', 401)
      }),
    )

    const client = createApiClient()
    client.setAccessToken('stale')
    await expect(client.request('/api/sys-identity/v1/login', { auth: false })).rejects.toMatchObject({ status: 401 })

    expect(refresh).not.toHaveBeenCalled()
    expect(authorizationSeen).toEqual([undefined])
  })

  it('设置语言后请求带 Accept-Language', async () => {
    let sent: RequestInit | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string, init?: RequestInit) => {
        sent = init
        return envelope(ok())
      }),
    )

    const client = createApiClient()
    client.setAcceptLanguage('zh-Hans')
    await client.request('/api/x')

    expect((sent?.headers as Record<string, string>)['Accept-Language']).toBe('zh-Hans')
  })

  it('退出清令牌后，在途刷新不会把旧账号令牌复活', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await gate
        return envelope(ok({ accessToken: 'old-account' }))
      }),
    )

    const client = createApiClient()
    const inFlight = client.refresh()
    // 刷新在途时用户退出：世代自增，刷新结果必须被丢弃。
    client.clearAccessToken()
    release()

    await expect(inFlight).resolves.toEqual({ ok: false, unavailable: false })
    expect(client.getAccessToken()).toBeNull()
  })
})
