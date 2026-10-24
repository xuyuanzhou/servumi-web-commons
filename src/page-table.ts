/**
 * 页表与菜单的纯逻辑：把「组声明 + 页声明 + 菜单树」翻成路由树与导航树。
 *
 * 真相源分成两份，各管一件事（见 docs/decisions/0013）：
 * - 有哪些页、每页落在哪个地址：`pages/<组>/router.ts` 与 `pages/<组>/<页>/index.ts` 两份自述说。
 *   目录只管归类，地址显式写在自述里，故目录怎么摆都不影响 URL。
 * - 左菜单长什么样、怎么排：`src/<端>/menu.ts` 一份菜单树说。它的 `key` 就是页的地址，
 *   故「菜单点了能落到哪一页」由构建期门禁核过，不靠渲染时兜底。
 * 两棵树各写各的，因此这里分开摊，渲染时再各取所需。
 *
 * 与渲染分开，是因为这里每个函数都是纯的、能在 node 环境的单测里直接覆盖；
 * 渲染那半（layout.tsx）依赖 antd 与 react-router，而「路径怎么匹配」已交给路由库，不必自己造。
 */
import type { ReactNode } from 'react'
import type { PortalPageProps } from './contract'

/**
 * 槽位页面。用函数组件写而不是契约里的 `PortalPage`：后者只承诺「返回 unknown」，
 * 不足以让 JSX 直接渲染；这里多给一条返回 `ReactNode` 的窄签名，两者可互相赋值。
 */
export type ModulePage = (props: PortalPageProps) => ReactNode

/** 页面组件的懒加载器：自述里写成 `() => import('./content')`，页面因此按需到达。 */
export type LazyPage = () => Promise<{ default: ModulePage }>

/**
 * 页声明：`pages/<组>/<页>/index.ts` 的默认导出。
 *
 * 只写页自己知道的事——落在哪一段地址、叫什么、渲染哪个组件；分组与排序不归它管。
 */
export type PageDefinition = {
  /** 页段：`/<段>`；写 `/` 表示就地落在组地址上，也就是组自己的那一页（一组最多一页）。 */
  path: string
  /** 页标题的键：菜单之外的页（如详情页）也靠它命名。文案在 `locale/*.json` 里。 */
  label: string
  /** 页面组件，写成 `() => import('./content')`。 */
  component: LazyPage
}

/**
 * 组声明：`pages/<组>/router.ts` 的默认导出。
 *
 * 组的地址是组内各页的公共前缀，故组自己不另占一层——它的页就是路由上的一层。
 */
export type PageGroup = {
  /** 组前缀：`/<段>`；写 `/` 表示这一组不占地址段（用于把页直接挂在模块根上）。 */
  path: string
  /** 组内页面清单。 */
  pages: PageDefinition[]
}

/** 端入口用 `import.meta.glob` 收上来的一个组模块；与槽位模块同形，故入口一行即可装配。 */
export type PageGroupModule = { default: PageGroup }
/** 端入口收上来的全部组：键是 glob 命中的文件路径，值是该组的模块。 */
export type PageGroups = Record<string, PageGroupModule>

/**
 * 菜单树的一项：`src/<端>/menu.ts` 里的一项。
 *
 * 它是另一棵树，不照抄路由：带 `children` 的是纯分组（点了只展开），不带的是落点（点了跳 `key`）。
 */
export type MenuItem = {
  /** 指向的模块内地址（如 `/registry/facts`），与页的完整地址同一套写法。 */
  key: string
  /** 菜单文案的键。文案在 `locale/*.json` 里。 */
  label: string
  /** 菜单图标；由各端自带，骨架只负责渲染，不猜模块想用什么。 */
  icon?: ReactNode
  /** 同级排序，小的在前；同序按数组里的先后。省缺为 0。 */
  order?: number
  /** 这一项下面的项。 */
  children?: MenuItem[]
}

/**
 * 摊平后的一个路由节点。
 *
 * `path` 是模块内完整地址（各级地址段拼成，无前导斜杠），也是它归属的菜单项，空串是模块根那一层；
 * `segment` 是它自己占的那一段，只给嵌套路由用——就地落在父级的那一层不占段，故为空串。
 */
export type RouteNode = {
  segment: string
  path: string
  page?: LazyPage
  label?: string
  children: RouteNode[]
}

/** 摊平后的一个菜单节点；`key` 与 `RouteNode.path` 同一套写法，故高亮时两边能直接对上。 */
export type MenuNode = {
  key: string
  label: string
  icon?: ReactNode
  children?: MenuNode[]
}

/** 菜单项 key 前缀：与落点路径分处两个命名空间，将来混进别的 kind 的菜单项也不会相撞。 */
export const MENU_KEY_PREFIX = 'page:'

export function menuKey(path: string): string {
  return `${MENU_KEY_PREFIX}${path}`
}

/** 把自述里的地址切成段：前导斜杠与重复斜杠都吃掉，`/` 因此切成空数组。 */
export function segmentsOf(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '')
}

/**
 * 自述地址归一成模块内完整地址（无前导斜杠）。
 *
 * 菜单的 `key` 与路由的 `path` 都先过这一步，两边才可比——门禁核菜单落点时也走这里，
 * 故「写 `/a/b` 还是 `a/b`」不会成为两处各写各样的口子。
 */
export function addressOf(path: string): string {
  return segmentsOf(path).join('/')
}

/** 拼模块内相对路径段；空串表示「停在这一层」，不产生新的一段。 */
export function joinPath(prefix: string, key: string): string {
  if (key === '') {
    return prefix
  }
  return prefix === '' ? key : `${prefix}/${key}`
}

/** 同级按 `order` 排；同序保持数组里的先后，故声明顺序仍是次序的兜底。 */
function byOrder(left: { order?: number }, right: { order?: number }): number {
  return (left.order ?? 0) - (right.order ?? 0)
}

/** 一个页声明摊成路由节点；`parent` 是它所属组的地址。 */
function toPageNode(parent: string, page: PageDefinition): RouteNode {
  const segment = addressOf(page.path)
  return { segment, path: joinPath(parent, segment), page: page.component, label: page.label, children: [] }
}

/**
 * 把各组声明摊成路由节点表。
 *
 * 组的地址是组内各页的公共前缀，故组自己不另占一层：组里 `path` 写 `/` 的那一页提为组自身的页面，
 * 其余页是它的子节点。组前缀写 `/` 时整组不占段，它的页直接落在模块根这一层——单页端因此能把页
 * 放在模块根上，不必凭空造一段地址。
 */
export function buildRouteNodes(groups: readonly PageGroup[]): RouteNode[] {
  const nodes: RouteNode[] = []
  for (const group of groups) {
    const prefix = addressOf(group.path)
    const pages = group.pages.map((page) => toPageNode(prefix, page))
    if (prefix === '') {
      nodes.push(...pages)
      continue
    }
    const own = pages.find((page) => page.segment === '')
    const kids = pages.filter((page) => page.segment !== '')
    nodes.push({
      segment: prefix,
      path: prefix,
      page: own?.page,
      label: own?.label,
      children: kids,
    })
  }
  return nodes
}

/** 把菜单树的自述摊成节点：各级按 `order` 排，`key` 归一成模块内地址。 */
export function buildMenuTree(items: readonly MenuItem[]): MenuNode[] {
  return [...items].sort(byOrder).map((item) => {
    const node: MenuNode = { key: addressOf(item.key), label: item.label, icon: item.icon }
    const kids = item.children
    if (kids !== undefined && kids.length > 0) {
      node.children = buildMenuTree(kids)
    }
    return node
  })
}

/** 左菜单是否超出了「只有一项」：是才值得占一列左菜单，否则页面直接铺满。 */
export function hasNavigation(menu: readonly MenuNode[]): boolean {
  return menu.length > 1 || menu.some((node) => (node.children?.length ?? 0) > 0)
}

/**
 * 菜单上第一个能直接打开的落点：地址没命中、或模块根那一层没页面时，兜底就落到这里。
 *
 * 按菜单次序取（同级已按 `order` 排好），故它总与用户看到的第一个可点项一致。动态段的页面
 * （如详情 `:id`）得带真参数才打得开，凭空跳等于造一个假参数，故跳过它们。
 */
export function firstPagePath(menu: readonly MenuNode[]): string | undefined {
  for (const node of menu) {
    const kids = node.children
    if (kids !== undefined && kids.length > 0) {
      const found = firstPagePath(kids)
      if (found !== undefined) {
        return found
      }
      continue
    }
    if (!node.key.includes(':')) {
      return node.key
    }
  }
  return undefined
}

/**
 * 选中项的祖先分组 key：深链直达子页时靠它把途经的分组都展开，否则选中项藏在收起的组里。
 */
export function ancestorKeys(menu: readonly MenuNode[], active: string): string[] {
  const trail: string[] = []
  const walk = (node: MenuNode, acc: string[]): boolean => {
    if (node.key === active) {
      trail.push(...acc)
      return true
    }
    const kids = node.children ?? []
    return kids.some((child) => walk(child, [...acc, menuKey(node.key)]))
  }
  return menu.some((node) => walk(node, [])) ? trail : []
}

/** 带子项的分组项默认展开，免得选中的子项藏在收起的分组里。 */
export function expandableKeys(menu: readonly MenuNode[]): string[] {
  const out: string[] = []
  const walk = (nodes: readonly MenuNode[]): void => {
    for (const node of nodes) {
      const kids = node.children
      if (kids === undefined || kids.length === 0) {
        continue
      }
      out.push(menuKey(node.key))
      walk(kids)
    }
  }
  walk(menu)
  return out
}
