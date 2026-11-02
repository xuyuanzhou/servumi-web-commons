import type { ReactNode } from 'react'
import { cx } from './class-names'

/**
 * 管理端内页骨架七段：页头 / 筛选条 / 面板 / 面板头 / 工具栏 / 宽表 / 覆盖式抽屉 / 翻页。
 *
 * 这里只出结构与原型类名，样式统一由壳的 `shell.css` 提供：模块 Remote 挂在壳里跑，
 * 加载时壳的全局类与语义令牌都已在 `:root`，所以在 commons 只收「骨架长什么样」这一份事实，
 * 免得 T2–T5 各自再抄一套度量、抄出差异。
 *
 * 类名照原型逐字沿用（含 `org-` 前缀那套面板：原型在权限管理视图里也复用了它，
 * 事实是「列表面板」的通用套件）。改名会丢掉与原型 DOM 的逐字可核对性。
 */

export type ManageModuleShellProps = {
  /** 页头槽：传 `ManageModuleHead`；没有页头时省略。 */
  head?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * 模块内页外壳：`.manage-module-shell > .manage-module-frame > 页头 + 正文`。
 *
 * `.manage-module-frame` 必须带 `position: relative`：覆盖式抽屉是相对它绝对定位的，
 * 这样抽屉只盖住模块内容区，不打断壳的顶栏与侧栏。
 */
export function ManageModuleShell({ head, className, children }: ManageModuleShellProps) {
  return (
    <div className={cx('manage-module-shell', className)}>
      <div className="manage-module-frame">
        {head}
        <div className="manage-module-body">{children}</div>
      </div>
    </div>
  )
}

export type ManageModuleHeadProps = {
  crumb?: ReactNode
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

/**
 * 模块页头。原型最终形态只剩右上角动作行：左侧「面包屑 + 标题 + 说明」整块被 CSS 隐藏，
 * 没有动作时整条页头不占位（原型用 `.manage-module-head:not(:has(.page-actions))` 表达，
 * 这里等价地在 JS 层早返回）。
 *
 * 标题与说明仍照原型渲染出 DOM（显隐交给 CSS）：只在一处判，免得 JS 与 CSS 各判一半。
 */
export function ManageModuleHead({ crumb, title, description, actions }: ManageModuleHeadProps) {
  if (actions === undefined) {
    return null
  }
  return (
    <div className="manage-module-head">
      <div>
        {crumb}
        {title === undefined ? null : <h1 className="manage-module-title">{title}</h1>}
        {description === undefined ? null : <p className="manage-module-desc">{description}</p>}
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  )
}

export type ManageFilterBarProps = {
  left?: ReactNode
  right?: ReactNode
  className?: string
}

/** 筛选条：左筛选右计数，窄屏换行。 */
export function ManageFilterBar({ left, right, className }: ManageFilterBarProps) {
  return (
    <div className={cx('manage-filterbar', className)}>
      <div className="manage-filterbar-left">{left}</div>
      <div className="manage-filterbar-right">{right}</div>
    </div>
  )
}

export type ManagePanelProps = {
  /** 树面板版式（`--tree`）或列表面板版式（`--list`）。 */
  variant?: 'tree' | 'list'
  /** 原型里树面板是 `aside`，列表面板是 `div`。 */
  as?: 'div' | 'aside'
  /** 面板头里的开关要靠 `aria-controls` 指回面板本体，故得能钉一个 id。 */
  id?: string
  className?: string
  children: ReactNode
}

/** 内容面板：卡片式外框，里面装面板头与面板体。 */
export function ManagePanel({ variant, as = 'div', id, className, children }: ManagePanelProps) {
  const Tag = as
  const variantClass = variant === undefined ? undefined : `org-panel--${variant}`
  return (
    <Tag id={id} className={cx('org-panel', variantClass, className)}>
      {children}
    </Tag>
  )
}

export type ManagePanelHeadProps = {
  /** 标题前的附加元素（如权限管理页的「当前部门」胶囊）。 */
  leading?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /**
   * 动作出口：`page` 落 `.page-actions`，`head` 落 `.org-panel-head-actions`。
   *
   * 原型两处写法不同——树面板头用后者（自带 `margin-inline-start: auto`），
   * 列表面板头与权限管理面板头用前者。其余差异（标题区是否包 `.org-panel-heading`）
   * 在壳的样式下不产生视觉分别，故只留这一个口子，免得三处各写一套。
   */
  actionsSlot?: 'page' | 'head'
  className?: string
}

/** 面板头：左标题（可带副标题与前置胶囊）右动作。 */
export function ManagePanelHead({
  leading,
  title,
  subtitle,
  actions,
  actionsSlot = 'page',
  className,
}: ManagePanelHeadProps) {
  return (
    <div className={cx('org-panel-head', className)}>
      <div className="org-panel-heading">
        {leading}
        <div>
          {title === undefined ? null : <h2 className="org-panel-title">{title}</h2>}
          {subtitle === undefined ? null : <div className="org-panel-sub">{subtitle}</div>}
        </div>
      </div>
      {actions === undefined ? null : (
        <div className={actionsSlot === 'head' ? 'org-panel-head-actions' : 'page-actions'}>{actions}</div>
      )}
    </div>
  )
}

export type ManagePanelBodyProps = {
  className?: string
  children: ReactNode
}

/** 面板体：列表面板里紧接面板头，装工具栏与宽表。 */
export function ManagePanelBody({ className, children }: ManagePanelBodyProps) {
  return <div className={cx('org-panel-body', className)}>{children}</div>
}

export type ManageToolbarProps = {
  main?: ReactNode
  side?: ReactNode
  className?: string
}

/** 列表面板工具栏：左侧搜索与筛选，右侧密度与计数。 */
export function ManageToolbar({ main, side, className }: ManageToolbarProps) {
  return (
    <div className={cx('org-list-toolbar', className)}>
      <div className="org-list-toolbar-main">{main}</div>
      <div className="org-list-toolbar-side">{side}</div>
    </div>
  )
}

export type ManageTableProps = {
  className?: string
  children: ReactNode
}

/**
 * 宽表：`.org-list-table > .card.table-scroll > table`，`children` 放 `thead` / `tbody`。
 *
 * 滚动发生在 `.card.table-scroll` 这一层：表头 `sticky` 要求最近的滚动祖先就是它，
 * 若让外层面板滚，卡片的 `overflow: hidden` 会把吸附吃掉。
 */
export function ManageTable({ className, children }: ManageTableProps) {
  return (
    <div className={cx('org-list-table', className)}>
      <div className="card table-scroll">
        <table>{children}</table>
      </div>
    </div>
  )
}

export type ManageDrawerProps = {
  open: boolean
  /** 无障碍名（`aria-label`），如「组织详情」。 */
  label: string
  title?: ReactNode
  subtitle?: ReactNode
  /** 面板头里、关闭按钮之前的附加动作（如状态标签）。 */
  actions?: ReactNode
  footer?: ReactNode
  /** 关闭按钮文案，由调用方给本地化文本。 */
  closeLabel: string
  className?: string
  children: ReactNode
  onClose: () => void
}

/**
 * 覆盖式详情抽屉：只盖模块内容区，不打断列表上下文。
 *
 * 关闭时用 `hidden` 而非卸载：原型如此（`.mx-drawer[hidden] { display: none }`），
 * 保留 DOM 也省掉每次开合重建表单的开销。
 */
export function ManageDrawer({
  open,
  label,
  title,
  subtitle,
  actions,
  footer,
  closeLabel,
  className,
  children,
  onClose,
}: ManageDrawerProps) {
  return (
    <div className={cx('mx-drawer', className)} role="dialog" aria-modal="true" aria-label={label} hidden={!open}>
      <div className="mx-drawer-scrim" data-drawer-close onClick={onClose} />
      <div className="mx-drawer-panel">
        <div className="mx-drawer-head">
          <div>
            {title === undefined ? null : <h3>{title}</h3>}
            {subtitle === undefined ? null : <div className="mx-drawer-sub">{subtitle}</div>}
          </div>
          <div className="page-actions">
            {actions}
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        </div>
        <div className="mx-drawer-body">{children}</div>
        {footer === undefined ? null : <div className="mx-drawer-foot">{footer}</div>}
      </div>
    </div>
  )
}

export type ManageDrawerSectionProps = {
  title?: ReactNode
  className?: string
  children: ReactNode
}

/** 抽屉内的分组：浅底圆角框，把一组键值对或表单圈在一起。 */
export function ManageDrawerSection({ title, className, children }: ManageDrawerSectionProps) {
  return (
    <section className={cx('drawer-section', className)}>
      {title === undefined ? null : <h4>{title}</h4>}
      {children}
    </section>
  )
}

export type ManagePagerProps = {
  info?: ReactNode
  nav?: ReactNode
  className?: string
}

/** 翻页条：贴卡片底边，左计数右按钮。 */
export function ManagePager({ info, nav, className }: ManagePagerProps) {
  return (
    <div className={cx('pager', className)}>
      <div className="pager-info">{info}</div>
      <div className="pager-nav">{nav}</div>
    </div>
  )
}
