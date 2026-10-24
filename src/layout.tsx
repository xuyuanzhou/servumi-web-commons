/**
 * 模块标准页面骨架：左侧模块自述的导航，右侧当前页面。
 *
 * 骨架放在 commons 而不是壳里，是为了让「装配态」与「独立运行态」用同一份实现：
 * 壳只负责「有哪些模块」这一级导航，模块自己的二级导航由模块每端的两份自述声明
 * （见 docs/frontend-architecture.md），两态因此不会走样，模块也不必知道自己被谁装配。
 *
 * 本端有哪些页、菜单怎么排，端入口都不逐一列举：页来自 `pages/<组>/router.ts` 收上来的组声明，
 * 菜单来自 `src/<端>/menu.ts`（见 docs/decisions/0013）。摊平在 ./page-table，这里只管三件事：
 * 把路由树翻成 react-router 的嵌套路由、渲染左菜单、给没命中的地址兜底到第一个菜单落点。模块内的
 * 地址怎么匹配、参数怎么取，都交给路由库——壳已用 `:moduleId/*` 通配，故这里写的路径以模块根为
 * 基准，不必自己剥前缀。
 */
import { Menu, Spin, theme, type MenuProps } from 'antd'
import {
  Suspense,
  lazy,
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
  type LazyExoticComponent,
  type ReactNode,
} from 'react'
import { Navigate, Outlet, matchRoutes, useLocation, useNavigate, useRoutes, type RouteObject } from 'react-router-dom'
import type { PortalPageProps, Translator } from './contract'
import { registerLocale } from './locale-runtime'
import {
  MENU_KEY_PREFIX,
  ancestorKeys,
  buildMenuTree,
  buildRouteNodes,
  expandableKeys,
  firstPagePath,
  hasNavigation,
  joinPath,
  menuKey,
  type LazyPage,
  type MenuItem,
  type MenuNode,
  type ModulePage,
  type PageGroups,
  type RouteNode,
} from './page-table'

export type PagesOptions = {
  /** 本端的菜单树：`menu.ts` 的默认导出，是菜单文案与次序的**真相源**。 */
  menu: readonly MenuItem[]
  /** 左菜单的无障碍名称与可见标题的**键**；模块内相对键，文案在 `locale/*.json` 里。 */
  navLabel?: string
}

export type ModuleLayoutProps = {
  /** 本端的路由树：组声明摊平后的结果。 */
  routes: readonly RouteNode[]
  /** 本端的菜单树：菜单自述摊平后的结果。 */
  menu: readonly MenuNode[]
  navLabel?: string
} & PortalPageProps

/**
 * 懒加载器的缓存：同一个自述只包一次 `lazy`，页面在同一个菜单项上来回切换时不至于被重挂载。
 * 键取加载器本身（自述在模块加载时就固定下来，引用不会变），故比按路径缓存更稳。
 */
const lazyPages = new WeakMap<LazyPage, LazyExoticComponent<ModulePage>>()

function asComponent(load: LazyPage): ComponentType<PortalPageProps> {
  let component = lazyPages.get(load)
  if (component === undefined) {
    component = lazy(load)
    lazyPages.set(load, component)
  }
  return component
}

/** 页面按需到达，故入口都用一个加载态兜住；管理端页面通常只有几十 KB，闪现一下就过去。 */
const loading = <Spin />

/** 懒加载的页面要拿到本端的公共入参，故每个落点渲染时都把 props 透下去。 */
function renderPage(load: LazyPage, page: PortalPageProps): ReactNode {
  const Page = asComponent(load)
  return (
    <Suspense fallback={loading}>
      <Page {...page} />
    </Suspense>
  )
}

/**
 * 菜单身份：只有「落点」（有页面的那一层）的路由才带它，`menuPath` 就是该菜单项的路径。
 * 有了它，高亮不必自己比对路径，交给路由库匹配后取最深的一条即可。
 */
type MenuHandle = { menuPath: string }

/**
 * 把一个路由节点翻成路由。
 *
 * 每个节点自己占一段路径，页面就是这一段的 index 路由，子节点是它的子路由——于是嵌套地址
 * （如 `task/list`）天然成立，参数也由路由库解析。分组层没有 `element`，渲染时 react-router
 * 会把 `<Outlet/>` 直接透传下去，故「这一层只是分组」与「这一层另有页面」都不必特判。
 *
 * 就地落在父级的那一层（`segment` 为空串）写成无路径的布局路由：它不占新的一段，只把索引路由
 * 挂在父级地址上，故 `path: ''` 那种空段写法不必出现。
 */
function toRoute(node: RouteNode, page: PortalPageProps): RouteObject {
  const children: RouteObject[] = []
  if (node.page !== undefined) {
    children.push({ index: true, element: renderPage(node.page, page), handle: { menuPath: node.path } })
  }
  for (const child of node.children) {
    children.push(toRoute(child, page))
  }
  return node.segment === '' ? { children } : { path: node.segment, children }
}

function toRoutes(routes: readonly RouteNode[], menu: readonly MenuNode[], page: PortalPageProps): RouteObject[] {
  const objects = routes.map((node) => toRoute(node, page))

  // 地址没命中（模块根那一层没页面，或路径打错、旧深链）时落到菜单上第一个能打开的落点，
  // 免得菜单还在、右侧却空着；`*` 排在最后，故真页面优先。
  const fallback = firstPagePath(menu)
  if (fallback === undefined) {
    return objects
  }
  return [...objects, { path: '*', element: <Navigate to={joinPath(page.basePath, fallback)} replace /> }]
}

/** 命中哪一层，左菜单就高亮哪一条：取匹配到的最深且有菜单身份的那一条。 */
function activeMenuPath(matches: readonly { route: { handle?: unknown } }[] | null): string | undefined {
  let active: string | undefined
  for (const match of matches ?? []) {
    const handle = match.route.handle as MenuHandle | undefined
    if (handle !== undefined) {
      active = handle.menuPath
    }
  }
  return active
}

function toMenuItems(entries: readonly MenuNode[], formatMessage: Translator): MenuProps['items'] {
  return entries.map((entry) => {
    const item = { key: menuKey(entry.key), label: formatMessage(entry.label), icon: entry.icon }
    const children = entry.children
    if (children === undefined || children.length === 0) {
      return item
    }
    return { ...item, children: toMenuItems(children, formatMessage) }
  })
}

type ModuleNavProps = {
  menu: readonly MenuNode[]
  navLabel?: string
  /** 当前该高亮的菜单项路径；由路由匹配得出，空串即模块根那一层。 */
  active?: string
} & PortalPageProps

/** 左侧导航 + 右侧内容；内容由 `<Outlet/>` 接住本模块的嵌套路由。 */
function ModuleNav({ menu, navLabel, active, ...page }: ModuleNavProps) {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  // 展开态受控：默认全展开，并在选中项变化时把它途经的分组补进来——否则直达子页时选中项
  // 藏在收起的组里看不到。只在选中项变化时补，用户随手折叠当前组不会被打断。
  const [openKeys, setOpenKeys] = useState(() => expandableKeys(menu))
  useEffect(() => {
    if (active === undefined) {
      return
    }
    const needed = ancestorKeys(menu, active)
    setOpenKeys((prev) => (needed.every((key) => prev.includes(key)) ? prev : [...new Set([...prev, ...needed])]))
  }, [menu, active])

  const content = <Outlet />

  // 只有一页时不必假装有二级导航，菜单与那一列都省掉，页面直接铺满。
  if (!hasNavigation(menu)) {
    return content
  }

  const go = (path: string): void => {
    navigate(path === '' ? page.basePath : joinPath(page.basePath, path))
  }
  const items = toMenuItems(menu, page.formatMessage)
  const label = navLabel === undefined ? undefined : page.formatMessage(navLabel)

  // 左侧导航栏：标题 + 竖直分隔线。用一条细线把导航与正文分开，比整块底色更贴合壳的白底面板。
  const railStyle: CSSProperties = {
    flex: '0 0 auto',
    width: 216,
    borderInlineEnd: `1px solid ${token.colorSplit}`,
    paddingInlineEnd: token.padding,
  }
  const titleStyle: CSSProperties = {
    marginBlockEnd: token.marginXS,
    paddingInline: token.paddingSM,
    fontSize: token.fontSizeLG,
    fontWeight: 600,
    color: token.colorTextHeading,
    lineHeight: `${token.controlHeight}px`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: token.paddingLG }}>
      <nav aria-label={label} style={railStyle}>
        {label === undefined ? null : <div style={titleStyle}>{label}</div>}
        <Menu
          mode="inline"
          items={items}
          selectedKeys={active === undefined ? [] : [menuKey(active)]}
          openKeys={openKeys}
          onOpenChange={(keys) => {
            setOpenKeys([...keys])
          }}
          onClick={({ key }) => {
            go(String(key).slice(MENU_KEY_PREFIX.length))
          }}
          style={{ borderInlineEnd: 'none' }}
        />
      </nav>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>{content}</div>
    </div>
  )
}

/**
 * 装配本模块的嵌套路由：一层无路径的布局路由承载左菜单，子路由就是路由树翻出来的页面。
 * 高亮的依据直接取自路由匹配结果（`handle` 里的菜单路径），不再自造一套路径比对。
 */
function ModuleLayout({ routes, menu, navLabel, ...page }: ModuleLayoutProps) {
  const { pathname } = useLocation()
  const objects = toRoutes(routes, menu, page)
  const active = activeMenuPath(matchRoutes(objects, { pathname }, page.basePath))
  // 模块被壳装配时不经过模块自己的 Provider，故在本模块的渲染边界登记一次：
  // 本模块的页面与非组件辅助代码因此都能直接取句。与 Provider 同理，必须同步登记——
  // 页面是本组件的子节点，放 effect 里会晚一拍。
  registerLocale(page.formatMessage, page.locale)
  return useRoutes([
    { element: <ModuleNav menu={menu} navLabel={navLabel} active={active} {...page} />, children: objects },
  ])
}

/**
 * 把端入口的两份自述套成槽位页面：组声明摊成路由，菜单自述摊成导航，地址与文案全从它们派生。
 *
 * 组声明是 `import.meta.glob('./pages/<组>/router.ts', { eager: true })` 收上来的记录，故加一组
 * 只需要新建目录，这里不必改名册。
 */
export function definePages(groups: PageGroups, options: PagesOptions): ModulePage {
  const routes = buildRouteNodes(Object.values(groups).map((module) => module.default))
  const menu = buildMenuTree(options.menu)

  function Pages(props: PortalPageProps): ReactNode {
    return <ModuleLayout routes={routes} menu={menu} navLabel={options.navLabel} {...props} />
  }
  return Pages
}
