import { describe, expect, it } from 'vitest'
import {
  MENU_KEY_PREFIX,
  addressOf,
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
  type PageDefinition,
  type PageGroup,
  type RouteNode,
} from './page-table'

/** 页面加载器；页面本身在纯逻辑里不参与运算，给个占位实现即可。 */
const load: LazyPage = async () => ({ default: () => null })

/** 页声明：只写地址与文案键，组件一律用占位加载器，除非另行指定。 */
function page(path: string, extra: Partial<PageDefinition> = {}): PageDefinition {
  return { path, label: `t.${path}`, component: load, ...extra }
}

/** 组声明：组前缀 + 页清单。 */
function group(path: string, pages: PageDefinition[]): PageGroup {
  return { path, pages }
}

/** 路由树的形状压成「完整地址 + 有没有页面」，断言起来一目了然，逐层展开。 */
function shape(nodes: readonly RouteNode[]): string[] {
  const mark = (node: RouteNode): string => (node.page === undefined ? node.path : `${node.path}*`)
  return nodes.flatMap((node) => [mark(node), ...shape(node.children)])
}

describe('addressOf', () => {
  it('前导斜杠与重复斜杠都吃掉，故写 /a/b 与 a/b 等价', () => {
    expect(addressOf('/a/b')).toBe('a/b')
    expect(addressOf('a/b')).toBe('a/b')
    expect(addressOf('//a//b/')).toBe('a/b')
  })

  it('单个斜杠归一到空串，即「不占地址段」', () => {
    expect(addressOf('/')).toBe('')
    expect(addressOf('')).toBe('')
  })
})

describe('buildRouteNodes', () => {
  it('组前缀不另占一层：组自己那页（path 写 /）就是组节点', () => {
    expect(shape(buildRouteNodes([group('/registry', [page('/')])]))).toEqual(['registry*'])
  })

  it('组内的页是组节点的子项，完整地址沿路拼出', () => {
    const nodes = buildRouteNodes([group('/registry', [page('/facts'), page('/paths')])])
    expect(shape(nodes)).toEqual(['registry', 'registry/facts*', 'registry/paths*'])
  })

  it('组前缀写 / 时整组不占段，它的页直接落在模块根这一层', () => {
    const nodes = buildRouteNodes([group('/', [page('/')])])
    expect(shape(nodes)).toEqual(['*'])
    expect(nodes[0].segment).toBe('')
  })

  it('单页端因此不必凭空造一段地址', () => {
    const nodes = buildRouteNodes([group('/', [page('/overview')])])
    expect(nodes.map((node) => node.path)).toEqual(['overview'])
  })

  it('无页面的组只作分组，不产生落点', () => {
    const nodes = buildRouteNodes([group('/registry', [page('/facts')])])
    expect(nodes[0].page).toBeUndefined()
    expect(nodes[0].label).toBeUndefined()
  })

  it('组自己的那页带有文案键，供分组标题之外的场合使用', () => {
    const nodes = buildRouteNodes([group('/registry', [page('/', { label: 'registry.home' })])])
    expect(nodes[0].label).toBe('registry.home')
  })

  it('多组各成一棵子树，顺序按传入先后', () => {
    const nodes = buildRouteNodes([group('/a', [page('/')]), group('/b', [page('/')])])
    expect(nodes.map((node) => node.path)).toEqual(['a', 'b'])
  })

  it('页段写多段或动态段时原样成为地址', () => {
    const nodes = buildRouteNodes([group('/lesson', [page('/:id')])])
    expect(nodes[0].children[0].segment).toBe(':id')
    expect(nodes[0].children[0].path).toBe('lesson/:id')
  })
})

describe('joinPath', () => {
  it('空串表示停在这一层，不产生新的一段', () => {
    expect(joinPath('', '')).toBe('')
    expect(joinPath('a', '')).toBe('a')
  })

  it('非空段拼在父级之下', () => {
    expect(joinPath('', 'a')).toBe('a')
    expect(joinPath('a', 'b')).toBe('a/b')
  })
})

describe('menuKey', () => {
  it('菜单项 key 与落点路径分处两个命名空间', () => {
    expect(menuKey('a')).toBe(`${MENU_KEY_PREFIX}a`)
    expect(menuKey('a')).not.toBe('a')
  })
})

describe('buildMenuTree', () => {
  /** 菜单项：`key` 即落点地址；`extra` 补写别处。 */
  function item(key: string, extra: Partial<MenuItem> = {}): MenuItem {
    return { key, label: `t.${key}`, ...extra }
  }

  it('key 归一成模块内地址，故菜单里写 /a 还是 a 都能与路由对上', () => {
    expect(buildMenuTree([item('/registry/facts')])[0].key).toBe('registry/facts')
  })

  it('同级按 order 排，同序保持自述里的先后', () => {
    const menu = buildMenuTree([item('alpha'), item('beta', { order: -1 }), item('gamma', { order: -1 })])
    expect(menu.map((node) => node.key)).toEqual(['beta', 'gamma', 'alpha'])
  })

  it('子项递归成树，同样按 order 排', () => {
    const menu = buildMenuTree([
      item('registry', { children: [item('registry/facts'), item('registry/paths', { order: -1 })] }),
    ])
    expect(menu[0].children?.map((node) => node.key)).toEqual(['registry/paths', 'registry/facts'])
  })

  it('子项的 key 是完整地址，不从父项推导：菜单树因此能跨地址挂子项', () => {
    const menu = buildMenuTree([item('registry', { children: [item('sys/user')] })])
    expect(menu[0].children?.[0].key).toBe('sys/user')
  })

  it('子项为空数组时不生成空 children', () => {
    const menu = buildMenuTree([item('registry', { children: [] })])
    expect(menu[0].children).toBeUndefined()
  })

  it('分组节点自带 label 与 icon，渲染时不再回路由树找', () => {
    const menu = buildMenuTree([item('registry', { label: 'registry.nav', icon: null })])
    expect(menu[0].label).toBe('registry.nav')
  })
})

describe('hasNavigation', () => {
  it('只有一项且没有子项时不必占左菜单', () => {
    expect(hasNavigation(buildMenuTree([{ key: 'progress', label: 't' }]))).toBe(false)
  })

  it('两项以上就算有导航', () => {
    const menu = buildMenuTree([
      { key: 'a', label: 't' },
      { key: 'b', label: 't' },
    ])
    expect(hasNavigation(menu)).toBe(true)
  })

  it('只有一项但带子项时也占左菜单', () => {
    const menu = buildMenuTree([{ key: 'sys', label: 't', children: [{ key: 'sys/user', label: 't' }] }])
    expect(hasNavigation(menu)).toBe(true)
  })

  it('空菜单没有导航', () => {
    expect(hasNavigation([])).toBe(false)
  })
})

describe('firstPagePath', () => {
  it('取菜单上第一个落点（同级已按 order 排好）', () => {
    const menu = buildMenuTree([
      { key: 'later', label: 't' },
      { key: 'first', label: 't', order: -1 },
    ])
    expect(firstPagePath(menu)).toBe('first')
  })

  it('首个分组是纯分组时继续下钻', () => {
    const menu = buildMenuTree([{ key: 'sys', label: 't', children: [{ key: 'sys/user', label: 't' }] }])
    expect(firstPagePath(menu)).toBe('sys/user')
  })

  it('跳过带动态段的落点：不带真参数打不开，不能拿来兜底', () => {
    const menu = buildMenuTree([
      {
        key: 'lesson',
        label: 't',
        children: [
          { key: 'lesson/:id', label: 't' },
          { key: 'lesson/catalog', label: 't' },
        ],
      },
    ])
    expect(firstPagePath(menu)).toBe('lesson/catalog')
  })

  it('菜单为空时没有兜底可言', () => {
    expect(firstPagePath([])).toBeUndefined()
  })
})

describe('ancestorKeys', () => {
  const menu = buildMenuTree([
    {
      key: 'sys',
      label: 't',
      children: [
        { key: 'sys/profile', label: 't' },
        { key: 'sys/avatar', label: 't' },
      ],
    },
  ])

  it('顶层项没有祖先', () => {
    expect(ancestorKeys(menu, 'sys')).toEqual([])
  })

  it('逐层给出途经的分组，深的在后', () => {
    expect(ancestorKeys(menu, 'sys/avatar')).toEqual([menuKey('sys')])
  })

  it('选中项不在树里时不给任何分组', () => {
    expect(ancestorKeys(menu, 'nowhere')).toEqual([])
  })

  it('三层菜单给出两层祖先', () => {
    const deep = buildMenuTree([
      { key: 'a', label: 't', children: [{ key: 'a/b', label: 't', children: [{ key: 'a/b/c', label: 't' }] }] },
    ])
    expect(ancestorKeys(deep, 'a/b/c')).toEqual([menuKey('a'), menuKey('a/b')])
  })
})

describe('expandableKeys', () => {
  it('只有带子项的分组进列表，且递归', () => {
    const menu = buildMenuTree([{ key: 'sys', label: 't', children: [{ key: 'sys/profile', label: 't' }] }])
    expect(expandableKeys(menu)).toEqual([menuKey('sys')])
  })

  it('落点不算可展开项', () => {
    expect(expandableKeys(buildMenuTree([{ key: 'progress', label: 't' }]))).toEqual([])
  })
})
