/**
 * 服务端统一响应信封的客户端侧定义与校验。
 *
 * 信封是壳、各 Remote 与所有后端服务之间唯一的响应形状（服务端见 `EnvelopeResult`、
 * `Envelopes`、`PlatformCodes`）。这里对每个响应做一次形状校验：拿到 200 但 body 不是信封，
 * 说明撞上了网关错误页或代理改写，此刻报错比把 `undefined` 透到页面上好查。
 */

export type Response<T = unknown> = {
  success: boolean
  code: string
  msg: string
  data: T
  traceId: string
}

/**
 * 解析并校验一份信封；形状不符直接抛错。
 *
 * 形参显式写作 {@code globalThis.Response}：本模块导出的信封类型也叫 `Response`，
 * 会在模块内遮蔽 Fetch API 的同名全局类型。
 */
export async function parseEnvelope(response: globalThis.Response): Promise<Response> {
  const payload = (await response.json()) as Response
  if (!payload || typeof payload.success !== 'boolean' || typeof payload.code !== 'string') {
    throw new Error('响应不是 Servumi 信封')
  }
  return payload
}
