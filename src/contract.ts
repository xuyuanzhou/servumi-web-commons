/**
 * Remote 与 Shell 之间的运行时契约。
 *
 * 契约的真相源在本包：壳与各 Remote 都从这里取类型与常量，不再各持一份同构副本。
 * 共享的是编译期类型与常量，运行期形状校验仍留在装配点（servumi-web 的 `src/remote/loader.ts`）——
 * 产物是跨仓、跨发布装配的，类型拦不住旧版本产物，装配点必须自己认出非法对象。
 *
 * 契约变更必须同步 `docs/frontend-architecture.md` 与 ADR-0007，不得只改一边。
 */
import { COMMONS_VERSION, contractDrift, readHostContract } from './contract-version'
import type { ApiEnvelope } from './envelope'
import { flattenLocaleMessages, type NestedMessages } from './locale'

/** 壳注入的会话摘要；匿名时为 null。只给标识，不含令牌与权限集合。 */
export type PortalSession = {
  id: string
}

/** 壳注入的最小上下文；Remote 的槽位页面只依赖这些显式入参，不读壳的 Context。 */
export type PortalPageProps = {
  /** 模块在当前端的根路径，如 /desktop/learn-lesson；Remote 的内部子路由挂在它下面。 */
  basePath: string
  /** 有效目录标签（小写地区，如 zh-cn），由壳协商后给出。 */
  locale: string
  /**
   * 已限定作用域的取句函数：壳先调 `getLocales(locale)`、按本模块 id 补上命名空间，再渲染页面。
   * Remote 里写**模块内相对键** `formatMessage('manage.fact.domain')`，等价于装配后的 `learn-lesson.manage.fact.domain`；
   * 缺键回退键名。
   */
  formatMessage: Translator
  /**
   * 带认证与静默刷新语义的请求函数；壳只放行本模块 apiPrefix 下的路径。
   * 独立运行时由本包的请求客户端顶上（见 `createApiClient`），语义与壳的实现等价。
   */
  request: ShellRequest
  /** 当前会话摘要；匿名访问公开入口时为 null，页面据此决定写操作是否可用。 */
  session: PortalSession | null
}

export type PortalPage = (props: PortalPageProps) => unknown

/**
 * 门户槽位名。这一份必须与 `@servumi/module-contract` 的 `PORTAL_RENDER_SLOTS` 取值一致：
 * 一边是 Remote 暴露什么（本包），一边是注册中心下发什么（契约包），两侧对不上就会「菜单里有、点进去空」。
 * 不共用同一个常量，是因为本包要守零运行时依赖，而契约包是各模块的构建期依赖。
 */
export const PORTAL_SLOTS = ['desktop', 'manage', 'mobile', 'publicDesktop', 'publicMobile'] as const

export type PortalSlot = (typeof PORTAL_SLOTS)[number]

/** Remote 暴露给壳的模块对象：可渲染的槽位 + 可选语言目录。 */
export type PortalRemoteModule = Partial<Record<PortalSlot, PortalPage>> & {
  /**
   * 返回本模块在该语言下的界面目录（**模块内相对键** → 文案）。壳补上模块 id 前缀后交给 `formatMessage`；
   * 返回 null 表示该语言无目录，壳回退源语言。
   */
  getLocales?: (
    locale: string,
  ) => Promise<Record<string, string> | null | undefined> | Record<string, string> | null | undefined
  /**
   * 本模块打包时所用的本包版本，由 `definePortalModule` 自动填。
   * 壳据此比对契约版本（见 `contract-version.ts`）；旧版本产物没有这个字段，故为可选。
   */
  commonsVersion?: string
}

/** 端入口（`src/<端>/index.ts`）的形状，供模块根对端目录做 `import.meta.glob` 扫描。 */
export type SlotModule = { default: PortalPage }

/** 端目录扫描结果：文件路径 → 端入口。键由构建器给出，形如 `./manage/index.ts`。 */
export type SlotModules = Record<string, SlotModule>

/** 模块语言目录：语言标签 → 嵌套目录（值是文案或更深一层）。 */
export type PortalLocales = Record<string, NestedMessages>

/** 语言包文件（`src/locale/<地区码>.json`）的形状，供模块根对语言目录做 `import.meta.glob` 扫描。 */
export type LocaleModule = { default: NestedMessages }

/** 语言目录扫描结果：文件路径 → 语言包。键由构建器给出，形如 `./locale/zh-cn.json`，文件名即地区码。 */
export type LocaleModules = Record<string, LocaleModule>

/** 模块根交进来的语言目录：手写的目录对象，或 `./locale/*.json` 的扫描结果。 */
export type PortalLocaleSource = PortalLocales | LocaleModules

/**
 * 模块自述定义：把槽位页面与语言目录收成一份，避免每个 Remote 都手写同一套 `getLocales` 胶水。
 *
 * 大多数模块只需要同步返回内置语言目录，直接传 `locales` 即可；若后续某模块要按需异步加载目录，
 * 再显式传 `getLocales` 覆盖这层默认行为。传进来的目录是嵌套对象，这里统一展平成点分键后再交给壳，
 * 模块因此只维护嵌套 JSON，不必自己写展平逻辑。
 */
export type PortalModuleDefinition = Omit<PortalRemoteModule, 'getLocales' | 'commonsVersion'> & {
  locales?: PortalLocaleSource
  getLocales?: PortalRemoteModule['getLocales']
}

/** 扫描式装配的附加项：端页面由目录决定，语言目录可手写也可扫描（见 `normalizeLocales`）。 */
export type PortalModuleOptions = {
  locales?: PortalLocaleSource
  getLocales?: PortalRemoteModule['getLocales']
}

/**
 * 声明模块自述。两种写法，效果同一条出口：
 *
 * - **扫描式**（推荐）：把端目录的扫描结果交进来，`src/<端>/index.ts` 在即占这一槽位，
 *   于是「加一个端」只需建一个目录，模块根不必再维护一份端名册。
 * - **显式**：直接给槽位页面，用于一个端入口要挂到多个槽位这类扫描表达不了的情形。
 *
 * 两种写法都会补齐公开槽位（见 `withPublicAliases`），因此公开模块也不必手写那两行别名。
 * 语言目录同理可以扫描（见 `isLocaleScan`）：「加一个语言」只需在 `src/locale/` 建一个文件。
 *
 * 判别不靠调用方声明，靠键的形状：`import.meta.glob` 的键一定是 `./<端>/index.ts` 或
 * `./locale/<地区码>.json` 这样的路径，而手写装配的键只能是槽位名或语言标签，两者不可能同形。
 */
export function definePortalModule(definition: PortalModuleDefinition): PortalRemoteModule
export function definePortalModule(slots: SlotModules, options?: PortalModuleOptions): PortalRemoteModule
export function definePortalModule(
  source: PortalModuleDefinition | SlotModules,
  options: PortalModuleOptions = {},
): PortalRemoteModule {
  return assemble(isSlotScan(source) ? { ...pickSlots(source), ...options } : source)
}

function isSlotScan(source: PortalModuleDefinition | SlotModules): source is SlotModules {
  return Object.keys(source).some((key) => key.includes('/'))
}

/**
 * 从扫描结果里挑出端页面：只认第一段就是槽位名的入口。
 * 这一层过滤是必需的——`src/` 下的 `api`、`locale` 等目录同样有自己的 `index.ts`，不能混进槽位表。
 */
function pickSlots(scanned: SlotModules): Partial<Record<PortalSlot, PortalPage>> {
  const picked: Partial<Record<PortalSlot, PortalPage>> = {}
  for (const [file, entry] of Object.entries(scanned)) {
    const slot = slotOf(file)
    if (slot !== undefined) {
      picked[slot] = entry.default
    }
  }
  return picked
}

function slotOf(file: string): PortalSlot | undefined {
  const [first] = file.replace(/^\.\//, '').split('/')
  return (PORTAL_SLOTS as readonly string[]).includes(first) ? (first as PortalSlot) : undefined
}

/**
 * 语言目录的来源判别：扫描结果的键是 `./locale/<地区码>.json` 这样的路径，
 * 手写目录的键只能是语言标签——语言标签不带扩展名，两者不可能同形。
 */
function isLocaleScan(source: PortalLocaleSource): source is LocaleModules {
  return Object.keys(source).some((key) => key.endsWith('.json'))
}

/** 语言目录归一到「地区码 → 嵌套目录」：扫描结果按文件名取地区码，手写目录原样沿用。 */
function normalizeLocales(source: PortalLocaleSource): PortalLocales {
  if (!isLocaleScan(source)) {
    return source
  }
  return Object.fromEntries(Object.entries(source).map(([file, entry]) => [regionOf(file), entry.default]))
}

/** 取语言包文件名里的地区码：`./locale/zh-cn.json` → `zh-cn`。文件名即地区码，与语言校验门同一约定。 */
function regionOf(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1).replace(/\.json$/, '')
}

/** 公开槽位与它默认复用的私有端。 */
const PUBLIC_SLOT_SOURCES: ReadonlyArray<readonly [PortalSlot, PortalSlot]> = [
  ['publicDesktop', 'desktop'],
  ['publicMobile', 'mobile'],
]

/**
 * 公开槽位默认复用对应私有端：匿名入口与私有端在多数模块里是同一份阅读页，
 * 让每个公开模块手写两行别名，只会把「模块根不出现端名册」这条规矩重新打开一个口。
 * 需要独立公开视图的模块显式传 `publicDesktop` / `publicMobile` 即可覆盖，表达力没有损失。
 */
function withPublicAliases(slots: Partial<Record<PortalSlot, PortalPage>>): Partial<Record<PortalSlot, PortalPage>> {
  const filled = { ...slots }
  for (const [publicSlot, privateSlot] of PUBLIC_SLOT_SOURCES) {
    if (filled[publicSlot] === undefined && filled[privateSlot] !== undefined) {
      filled[publicSlot] = filled[privateSlot]
    }
  }
  return filled
}

function assemble({ locales, getLocales, ...slots }: PortalModuleDefinition): PortalRemoteModule {
  const flattened =
    locales === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(normalizeLocales(locales)).map(([locale, messages]) => [
            locale,
            flattenLocaleMessages(messages),
          ]),
        )
  warnOnContractDrift()
  return {
    ...withPublicAliases(slots),
    getLocales: getLocales ?? (flattened === undefined ? undefined : (locale) => flattened[locale] ?? null),
    commonsVersion: COMMONS_VERSION,
  }
}

/**
 * 装配期比对契约版本：本模块打包时用的底座版本 vs 宿主正在跑的那一份。
 *
 * 只告警不阻断——跨版本装配多数仍能工作，把模块整个拦下比版本漂移本身的伤害更大；
 * 告警留给开发者在控制台里对上版本号（见 ADR-0015）。没有宿主时（独立运行）无从比对，直接跳过。
 */
function warnOnContractDrift(): void {
  const host = readHostContract()
  if (host === null || !contractDrift(COMMONS_VERSION, host.commonsVersion)) {
    return
  }
  console.warn(
    `[servumi] 契约版本漂移：本模块基于 servumi-web-commons ${COMMONS_VERSION}，宿主为 ${host.commonsVersion}。`,
  )
}

/** 统一请求函数：带认证与静默刷新，返回服务端信封。 */
export type ShellRequest = <T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown; auth?: boolean; signal?: AbortSignal; timeout?: number },
) => Promise<ApiEnvelope<T>>

/** 取句子函数；缺键回退键名，不返回空白。 */
export type Translator = (key: string, values?: Record<string, string | number>) => string

/** 壳的私有区登录入口；Remote 只在「未登录」提示里引用它，不自行实现登录页。 */
export const LOGIN_ROUTE = '/login'

/*
 * 壳的一级路由常量：页面在越权/异常时需要退回管理首页，而这些路径由壳决定。
 * 壳改了这几条路径，这里必须同改——跨仓共享的就是这份常量。
 */
export const ADMIN_ROUTE = '/admin'
export const MOBILE_ADMIN_ROUTE = '/mobile/admin'
