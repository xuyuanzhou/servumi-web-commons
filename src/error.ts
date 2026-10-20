import type { ApiEnvelope } from './envelope'

/**
 * 接口错误：非 2xx 或 `success === false` 时的统一抛出物。
 *
 * 跨仓装配后，页面与壳各持本包的一份副本（各自打包），类标识不同却同名。
 * 因此判定方一律看结构化形状（见 `format-error.ts`），不用 `instanceof`。
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string

  constructor(status: number, envelope: ApiEnvelope) {
    super(envelope.message || envelope.code)
    this.name = 'ApiError'
    this.status = status
    this.code = envelope.code
    this.requestId = envelope.requestId
  }
}
