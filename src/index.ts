/**
 * Servumi 前端 API 对接底座。对外只有这一张清单，消费方一律从包根导入。
 */
export { parseEnvelope, type ApiEnvelope } from './envelope'
export { ApiError } from './error'
export { createModuleApi, type ModuleApi, type ModuleApiRequestOptions } from './api-factory'
export {
  createApiClient,
  type ApiClient,
  type ApiClientOptions,
  type RefreshResult,
  type RequestOptions,
} from './request'
export { createFormatError, errorCode, errorStatus } from './format-error'
export {
  FALLBACK_LANG,
  createLocaleTranslator,
  createTranslator,
  flattenLocaleMessages,
  formatWhen,
  interpolate,
  messageOf,
  namespaceLocaleMessages,
  negotiate,
  normalizeTag,
  readLocalizedText,
  selectLocaleBundle,
  type LocaleBundle,
  type NestedMessages,
} from './locale'
export {
  LocaleContext,
  LocaleProvider,
  readBrowserLocales,
  useLocale,
  type LocaleContextValue,
  type LocaleProviderProps,
} from './i18n-react'
export { currentLocale, formatMessage, registerLocale, resetLocale } from './locale-runtime'
export { type RuntimeModuleManifest } from './module-manifest'
export { AdminSurface, AdminToolbar, type AdminSurfaceProps, type AdminToolbarProps } from './admin-page'
export { StandardContentPage, type StandardContentPageProps } from './content-page'
export { definePages, type ModuleLayoutProps, type PagesOptions } from './layout'
export {
  type LazyPage,
  type MenuItem,
  type MenuNode,
  type ModulePage,
  type PageDefinition,
  type PageGroup,
  type PageGroupModule,
  type PageGroups,
  type RouteNode,
} from './page-table'
export {
  LIST_CURSOR_KEY,
  LIST_PAGE_KEY,
  LIST_QUERY_KEY,
  readCursorListState,
  readOffsetListState,
  reconcilePage,
  writeCursorListState,
  writeOffsetListState,
  type CursorListState,
  type OffsetListState,
} from './list-query'
export { useCursorListQuery, useOffsetListQuery, type CursorListQuery, type OffsetListQuery } from './use-list-query'
export {
  COMMONS_VERSION,
  contractDrift,
  readHostContract,
  writeHostContract,
  type HostContract,
} from './contract-version'
export {
  ADMIN_ROUTE,
  LOGIN_ROUTE,
  MOBILE_ADMIN_ROUTE,
  PORTAL_SLOTS,
  definePortalModule,
  type LocaleModule,
  type LocaleModules,
  type PortalLocaleSource,
  type PortalLocales,
  type PortalModuleDefinition,
  type PortalModuleOptions,
  type PortalPage,
  type PortalPageProps,
  type PortalRemoteModule,
  type PortalSession,
  type PortalSlot,
  type ShellRequest,
  type SlotModule,
  type SlotModules,
  type Translator,
} from './contract'
