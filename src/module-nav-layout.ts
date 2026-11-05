/**
 * 模块二级导航的摆放决策：能用竖排左栏就用左栏，装不下就换成一排顶部段控。
 *
 * 与渲染分开，是因为这里的判断是纯的、能在 node 环境的单测里直接覆盖；
 * 「一行放不放得下」由组件用 `ResizeObserver` 实测后交进来，这里不猜断点。
 */
import type { MenuNode } from './page-table'

export type ModuleNavLayout = 'rail' | 'segment'

/**
 * 竖排左栏的最小可用宽度：栏自身 216px + 与正文的间距 24px，再给正文留出 480px。
 *
 * 取 720 而不是更小的值：正文窄于 480px 时，表格与筛选条都要横滚，
 * 那时把导航折到顶部、整宽还给正文，比继续并排挤正文更值。
 */
const RAIL_MIN_WIDTH = 720

export function resolveModuleNavLayout({ availableWidth }: { availableWidth: number }): ModuleNavLayout {
  return availableWidth >= RAIL_MIN_WIDTH ? 'rail' : 'segment'
}

/** 段控里的一节：分组头（可缺）+ 这一节里可以点的落点。 */
export type SegmentNavSection = {
  /** 这一节来自哪个菜单项，同时用作渲染 key；菜单项的 key 在模块内唯一。 */
  key: string
  /** 分组文案的键；平铺的落点没有分组，故为空。 */
  label?: string
  /** 这一节里的落点；`path` 是模块内地址，与 `MenuNode.key` 同一套写法。 */
  items: { path: string; label: string }[]
}

/**
 * 把菜单树摊成段控的若干节。
 *
 * 带 `children` 的分组项在窄屏拍平：分组名退成一个不可点的前置标签，子项紧随其后。
 * 这样「分组 → 组内落点」的阅读顺序还在，点击却只有一跳——不必先展开分组再选页。
 * 平铺的落点各自成一节（无标签），故多页平铺的菜单在窄屏仍是一排按钮。
 */
export function buildSegmentSections(menu: readonly MenuNode[]): SegmentNavSection[] {
  return menu.map((node) => {
    const kids = node.children ?? []
    if (kids.length === 0) {
      return { key: node.key, items: [{ path: node.key, label: node.label }] }
    }
    return {
      key: node.key,
      label: node.label,
      items: kids.map((child) => ({ path: child.key, label: child.label })),
    }
  })
}
