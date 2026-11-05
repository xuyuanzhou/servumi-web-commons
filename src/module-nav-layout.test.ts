import { describe, expect, it } from 'vitest'
import { buildSegmentSections, resolveModuleNavLayout } from './module-nav-layout'
import type { MenuNode } from './page-table'

describe('resolveModuleNavLayout', () => {
  it('容器装得下 216px 左栏时仍用左栏', () => {
    expect(resolveModuleNavLayout({ availableWidth: 720 })).toBe('rail')
    expect(resolveModuleNavLayout({ availableWidth: 1024 })).toBe('rail')
  })

  it('再窄一像素就折成顶部段控，把整宽让给正文', () => {
    expect(resolveModuleNavLayout({ availableWidth: 719 })).toBe('segment')
    expect(resolveModuleNavLayout({ availableWidth: 390 })).toBe('segment')
  })
})

describe('buildSegmentSections', () => {
  it('平铺的落点各自成一节，故窄屏仍是一排同级的按钮', () => {
    const menu: MenuNode[] = [
      { key: 'overview', label: 'manage.overview' },
      { key: 'roles', label: 'manage.role.title' },
      { key: 'permissions', label: 'manage.permission.title' },
    ]

    expect(buildSegmentSections(menu)).toEqual([
      { key: 'overview', items: [{ path: 'overview', label: 'manage.overview' }] },
      { key: 'roles', items: [{ path: 'roles', label: 'manage.role.title' }] },
      { key: 'permissions', items: [{ path: 'permissions', label: 'manage.permission.title' }] },
    ])
  })

  it('分组拍平：组名退成前置标签，组内落点紧随其后，点击仍只有一跳', () => {
    const menu: MenuNode[] = [
      { key: 'overview', label: 'manage.overview' },
      {
        key: 'registry',
        label: 'manage.registry.title',
        children: [
          { key: 'registry/facts', label: 'manage.fact.title' },
          { key: 'registry/paths', label: 'manage.path.title' },
        ],
      },
    ]

    expect(buildSegmentSections(menu)).toEqual([
      { key: 'overview', items: [{ path: 'overview', label: 'manage.overview' }] },
      {
        key: 'registry',
        label: 'manage.registry.title',
        items: [
          { path: 'registry/facts', label: 'manage.fact.title' },
          { path: 'registry/paths', label: 'manage.path.title' },
        ],
      },
    ])
  })

  it('空分组不产生空标签：没有子项就按落点算', () => {
    const menu: MenuNode[] = [{ key: 'solo', label: 'manage.solo', children: [] }]

    expect(buildSegmentSections(menu)).toEqual([{ key: 'solo', items: [{ path: 'solo', label: 'manage.solo' }] }])
  })

  it('空菜单摊出空数组', () => {
    expect(buildSegmentSections([])).toEqual([])
  })
})
