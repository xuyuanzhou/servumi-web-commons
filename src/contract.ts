/**
 * Remote 与 Shell 之间的运行时契约。
 *
 * 契约的真相源在本包：壳与各 Remote 都从这里取类型与常量，不再各持一份同构副本。
 * 共享的是编译期类型与常量，运行期形状校验仍留在装配点（servumi-web 的 `src/remote/loader.ts`）——
 * 产物是跨仓、跨发布装配的，类型拦不住旧版本产物，装配点必须自己认出非法对象。
 *
 * 契约变更必须同步 `docs/frontend-architecture.md` 与 ADR-0007，不得只改一边。
 */
import type { ApiEnvelope } from './envelope'

/** 壳注入的会话摘要；匿名时为 null。只给标识，不含令牌与权限集合。 */
export type PortalSession = {
  id: string
}

/** 壳注入的最小上下文；Remote 的槽位页面只依赖这些显式入参，不读壳的 Context。 */
export type PortalPageProps = {
  /** 模块在当前端的根路径，如 /desktop/learn-lesson；Remote 的内部子路由挂在它下面。 */
  basePath: string
  /** 有效目录标签（BCP 47），由壳协商后给出。 */
  locale: string
  /**
   * 已合并本模块语言目录的取句函数。壳先调 `getLocales(locale)` 再渲染页面，
   * 因此 Remote 里的 `t("learn-lesson.*")` 取到的是本模块文案，缺键回退键名。
   */
  t: Translator
  /**
   * 带认证与静默刷新语义的请求函数；壳只放行本模块 apiPrefix 下的路径。
   * 独立运行时由本包的请求客户端顶上（见 `createApiClient`），语义与壳的实现等价。
   */
  request: ShellRequest
  /** 当前会话摘要；匿名访问公开入口时为 null，页面据此决定写操作是否可用。 */
  session: PortalSession | null
}

export type PortalPage = (props: PortalPageProps) => unknown

/** Remote 暴露给壳的模块对象：可渲染的槽位 + 可选语言目录。 */
export type PortalRemoteModule = {
  desktop?: PortalPage
  manage?: PortalPage
  mobile?: PortalPage
  publicDesktop?: PortalPage
  publicMobile?: PortalPage
  /**
   * 返回本模块在该语言下的界面目录（点分键 → 文案）。
   * 壳合并后交给 `t`；返回 null 表示该语言无目录，壳回退源语言。
   */
  getLocales?: (
    lang: string,
  ) => Promise<Record<string, string> | null | undefined> | Record<string, string> | null | undefined
}

/** 统一请求函数：带认证与静默刷新，返回服务端信封。 */
export type ShellRequest = <T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown; auth?: boolean },
) => Promise<ApiEnvelope<T>>

/** 取句子函数；缺键回退键名，不返回空白。 */
export type Translator = (key: string, values?: Record<string, string | number>) => string

export const FALLBACK_LANG = 'zh-Hans'

/** 壳的私有区登录入口；Remote 只在「未登录」提示里引用它，不自行实现登录页。 */
export const LOGIN_ROUTE = '/login'

/*
 * 壳的一级路由常量：页面在越权/异常时需要退回管理首页，而这些路径由壳决定。
 * 壳改了这几条路径，这里必须同改——跨仓共享的就是这份常量。
 */
export const ADMIN_ROUTE = '/admin'
export const MOBILE_ADMIN_ROUTE = '/mobile/admin'
