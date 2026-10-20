/**
 * Servumi 前端 API 对接底座。对外只有这一张清单，消费方一律从包根导入。
 */
export { parseEnvelope, type ApiEnvelope } from './envelope'
export { ApiError } from './error'
export {
  createApiClient,
  type ApiClient,
  type ApiClientOptions,
  type RefreshResult,
  type RequestOptions,
} from './request'
export { createFormatError, errorCode, errorStatus } from './format-error'
export {
  ADMIN_ROUTE,
  FALLBACK_LANG,
  LOGIN_ROUTE,
  MOBILE_ADMIN_ROUTE,
  type PortalPage,
  type PortalPageProps,
  type PortalRemoteModule,
  type PortalSession,
  type ShellRequest,
  type Translator,
} from './contract'
