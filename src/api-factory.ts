import type { ShellRequest } from './contract'

export type ModuleApiRequestOptions = {
  method?: string
  body?: unknown
  auth?: boolean
}

export type ModuleApi = {
  apiPrefix: string
  path: (suffix?: string) => string
  call: <T>(path: string, options?: ModuleApiRequestOptions) => Promise<T>
  get: <T>(path: string) => Promise<T>
  post: <T>(path: string, body?: unknown) => Promise<T>
  patch: <T>(path: string, body?: unknown) => Promise<T>
  put: <T>(path: string, body?: unknown) => Promise<T>
  delete: <T>(path: string) => Promise<T>
}

/**
 * 模块级 API 工厂：把「只能请求自己的 apiPrefix」这条约束沉到共享包。
 *
 * 这样做不是为了把业务 API 抽成黑盒，而是把所有模块都重复写的前缀断言、`.data` 解包和
 * HTTP 动词胶水收成一份，让各模块自己的 `api.ts` 只保留领域路径与返回值整形。
 */
export function createModuleApi(request: ShellRequest, apiPrefix: string): ModuleApi {
  function assertOwnPrefix(path: string): void {
    if (!path.startsWith(apiPrefix)) {
      throw new Error('请求必须使用 ' + apiPrefix)
    }
  }

  function path(suffix = ''): string {
    if (suffix === '') {
      return apiPrefix
    }
    return suffix.startsWith('/') ? `${apiPrefix}${suffix}` : `${apiPrefix}/${suffix}`
  }

  async function call<T>(target: string, options?: ModuleApiRequestOptions): Promise<T> {
    assertOwnPrefix(target)
    return (await request<T>(target, options)).data
  }

  return {
    apiPrefix,
    path,
    call,
    get: (target) => call(target),
    post: (target, body) => call(target, { method: 'POST', body }),
    patch: (target, body) => call(target, { method: 'PATCH', body }),
    put: (target, body) => call(target, { method: 'PUT', body }),
    delete: (target) => call(target, { method: 'DELETE' }),
  }
}
