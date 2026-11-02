import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react'
import { cx } from './class-names'

/**
 * 管理端内页里反复出现的控件：两栏布局 / 计数徽标 / 搜索框 / 派生信息行 / 筛选 chip /
 * 密度段控 / 翻页按钮 / 键值对 / 单元格 / 状态标签。
 *
 * 与 `manage-module.tsx` 同属一套：那边出「骨架」，这边出「装进骨架里的通用控件」。
 * 分两个文件只为可读，导入方一律从包根取，不必知道斜体分家。
 *
 * 类名一律照原型逐字沿用（`.org-*` 前缀那套是「列表面板」的通用套件，权限管理视图里也复用它），
 * 样式统一由壳的 `shell.css` 提供；此处只固定「长什么样」，免得 T2–T5 各抄一套度量抄出差异。
 *
 * 公共库不带图标依赖（peerDeps 里没有 `@ant-design/icons`），故凡需图标处一律由调用方传入节点。
 */

export type ManageLayoutProps = {
  className?: string
  children: ReactNode
}

/**
 * 两栏工作区：左树右表，窄窗自动收单列（收窄规则在壳的 `shell.css` 里）。
 *
 * 只做 `display: grid` 的容器；哪个孩子落哪一栏由 DOM 顺序决定，与原型一致。
 */
export function ManageLayout({ className, children }: ManageLayoutProps) {
  return <div className={cx('org-layout', className)}>{children}</div>
}

export type ManageCountProps = {
  className?: string
  children: ReactNode
}

/** 计数徽标：面板头右侧或工具栏里的小胶囊，只陈述条数。 */
export function ManageCount({ className, children }: ManageCountProps) {
  return <span className={cx('org-count', className)}>{children}</span>
}

export type ManageSearchProps = {
  value: string
  onChange: (value: string) => void
  /** 回车提交：停手防抖之外的一条立即路径。 */
  onSubmit?: () => void
  placeholder?: string
  /** 搜索图标；公共库不带图标依赖，故由调用方传入。 */
  icon?: ReactNode
  disabled?: boolean
  /** 无障碍名；无可见标签时必填。 */
  label: string
  /** 输入上限；搜索词直接进查询串，调用方按后端口径给个上限。 */
  maxLength?: number
  className?: string
}

/**
 * 搜索框：原型是「圆角药丸 + 前置图标」，故画成外壳 + 内层裸输入框两层——
 * 外层给壳的 `.org-search` 描边与高度，内层去掉浏览器默认样式，只留文字。
 */
export function ManageSearch({
  value,
  onChange,
  onSubmit,
  placeholder,
  icon,
  disabled,
  label,
  maxLength,
  className,
}: ManageSearchProps) {
  return (
    <span className={cx('org-search', className)}>
      {icon === undefined ? null : (
        <span className="org-search-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <input
        className="org-search-input"
        type="search"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onSubmit?.()
          }
        }}
      />
    </span>
  )
}

export type ManageHintRowProps = {
  left?: ReactNode
  right?: ReactNode
  className?: string
}

/** 派生信息行：贴着表格或树的下沿，左事实右补充，窄了换行。 */
export function ManageHintRow({ left, right, className }: ManageHintRowProps) {
  return (
    <div className={cx('org-hint-row', className)}>
      {left === undefined ? null : <span>{left}</span>}
      {right === undefined ? null : <span>{right}</span>}
    </div>
  )
}

export type ManageFilterChipProps = {
  /** 选中态：原型用 `.is-on` 浮底。 */
  on?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
  children: ReactNode
}

/** 筛选胶囊：一枚就是一个筛选口径，选中态自带 `aria-pressed`，键鼠同源。 */
export function ManageFilterChip({ on = false, disabled, onClick, className, children }: ManageFilterChipProps) {
  return (
    <button
      type="button"
      className={cx('filter-chip', on && 'is-on', className)}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** 表格密度两档：舒适（原型默认 56px 行高）/ 紧凑（44px）。 */
export type TableDensity = 'roomy' | 'compact'

/** 密度记忆的落盘键与原型同值；值是「作用域:分段名 → 档位」的映射，各列表各记各的。 */
const DENSITY_MEMORY_KEY = 'servumi.table.density'

/** 读作用域：原型读 `.app` 的 `data-scope`，壳里对等物是根元素的同一个属性。 */
function readScope(): string {
  if (typeof document === 'undefined') {
    return 'default'
  }
  return document.documentElement.dataset.scope ?? 'default'
}

function readDensityMemory(): Record<string, string> {
  if (typeof localStorage === 'undefined') {
    return {}
  }
  try {
    return JSON.parse(localStorage.getItem(DENSITY_MEMORY_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function readDensity(key: string): TableDensity {
  return readDensityMemory()[key] === 'compact' ? 'compact' : 'roomy'
}

/**
 * 表格密度：档位落在根元素的 `data-density` 上（行高由壳的 CSS 变量响应），
 * 并按「作用域:分段名」记进 localStorage，下次进来还是上次那一档。
 *
 * `segment` 缺省即原型里不带值的那个分段（组织页），权限管理页给 `identity`，两页各记各的。
 */
export function useTableDensity(segment?: string): [TableDensity, (next: TableDensity) => void] {
  const key = `${readScope()}:${segment ?? 'default'}`
  const [density, setDensity] = useState<TableDensity>(() => readDensity(key))

  // 档位挂在根元素上而不是组件上：行高是壳的 CSS 变量，得让整棵壳都看得到。
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.density = density
    }
  }, [density])

  const update = useCallback(
    (next: TableDensity) => {
      setDensity(next)
      if (typeof localStorage === 'undefined') {
        return
      }
      localStorage.setItem(DENSITY_MEMORY_KEY, JSON.stringify({ ...readDensityMemory(), [key]: next }))
    },
    [key],
  )

  return [density, update]
}

export type ManageDensitySegProps = {
  /** 记忆分段名；缺省与原型一致，落 `default`。 */
  segment?: string
  roomyLabel: string
  compactLabel: string
  className?: string
}

/** 密度段控：两枚按钮的互斥组，自己管记忆与落盘，调用方只要给分段名与两档文案。 */
export function ManageDensitySeg({ segment, roomyLabel, compactLabel, className }: ManageDensitySegProps) {
  const [density, setDensity] = useTableDensity(segment)
  return (
    <div className={cx('density-seg', className)} data-density-seg={segment ?? ''}>
      <button
        type="button"
        className={cx('density-btn', density === 'roomy' && 'is-on')}
        data-density="roomy"
        aria-pressed={density === 'roomy'}
        onClick={() => setDensity('roomy')}
      >
        {roomyLabel}
      </button>
      <button
        type="button"
        className={cx('density-btn', density === 'compact' && 'is-on')}
        data-density="compact"
        aria-pressed={density === 'compact'}
        onClick={() => setDensity('compact')}
      >
        {compactLabel}
      </button>
    </div>
  )
}

export type ManagePagerNavProps = {
  page: number
  pageCount: number
  onChange: (page: number) => void
  prevLabel: string
  nextLabel: string
  className?: string
}

/** 同一屏最多摆几个页码：够翻又不会把上一页/下一页挤出工具栏。 */
const PAGER_WINDOW = 5

/**
 * 翻页按钮组：上一页 + 页码窗 + 下一页。
 *
 * 页码窗跟着当前页走，故深链粘来一个很大的页码时也不会摆出一长排按钮；
 * 越界的那两颗置灰而不是藏起来，按钮位置因此不跳。
 */
export function ManagePagerNav({ page, pageCount, onChange, prevLabel, nextLabel, className }: ManagePagerNavProps) {
  const start = Math.max(1, Math.min(page - Math.floor(PAGER_WINDOW / 2), pageCount - PAGER_WINDOW + 1))
  const end = Math.min(pageCount, start + PAGER_WINDOW - 1)
  const pages: number[] = []
  for (let current = start; current <= end; current += 1) {
    pages.push(current)
  }

  return (
    <div className={cx('pager-nav', className)}>
      <button type="button" className="pager-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {prevLabel}
      </button>
      {pages.map((current) => (
        <button
          key={current}
          type="button"
          className={cx('pager-btn', current === page && 'is-on')}
          aria-current={current === page ? 'page' : undefined}
          onClick={() => onChange(current)}
        >
          {current}
        </button>
      ))}
      <button type="button" className="pager-btn" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        {nextLabel}
      </button>
    </div>
  )
}

export type ManageKeyValueItem = {
  label: ReactNode
  value: ReactNode
}

export type ManageKeyValueListProps = {
  items: ManageKeyValueItem[]
  className?: string
}

/** 键值对：左标签右值，标签定宽让多组在竖向上对齐（抽屉里的「基本信息」就是这么一组）。 */
export function ManageKeyValueList({ items, className }: ManageKeyValueListProps) {
  return (
    <dl className={cx('kv', className)}>
      {items.map((item, index) => (
        <Fragment key={index}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

export type ManageCellProps = {
  /** 主信息：加粗的一行。 */
  strong: ReactNode
  /** 次信息：主信息下的浅色一行，缺省不占位。 */
  sub?: ReactNode
  className?: string
}

/** 表格单元格的主次两行：块级排列，不需要额外的换行符。 */
export function ManageCell({ strong, sub, className }: ManageCellProps) {
  return (
    <span className={className}>
      <span className="cell-strong">{strong}</span>
      {sub === undefined ? null : <span className="cell-sub">{sub}</span>}
    </span>
  )
}

export type ManageTagTone = 'ok' | 'warn' | 'idle' | 'off'

export type ManageTagProps = {
  /** 语义档：正常 / 待处理 / 未定 / 停用；缺省只画中性胶囊。 */
  tone?: ManageTagTone
  className?: string
  children: ReactNode
}

/** 状态标签：小圆点 + 文案，四档语义色；圆点走 `currentColor`，故只在壳里声明一次。 */
export function ManageTag({ tone, className, children }: ManageTagProps) {
  return <span className={cx('tag', tone === undefined ? undefined : `tag--${tone}`, className)}>{children}</span>
}
