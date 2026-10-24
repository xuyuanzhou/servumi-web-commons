/**
 * 列表页地址栏状态：把「翻到哪一屏 / 搜了什么」放 URL，而不是组件 state。
 *
 * 放 URL 的好处是刷新、粘深链、浏览器前进/后退都能回到同一屏，且「列表现在显示什么」只有
 * 一个真相源；代价是读写规则要在每个列表页各写一遍。所以沉到这里，各端共用一份。
 *
 * 这里只提供两条轨，对应后端 `servumi-security` 的分页契约：
 * - offset 轨（`?page=`）：小表与治理/配置表按页码翻，要总数、要跳页。
 * - 游标轨（`?cursor=`）：持续增长的大表按游标翻，深分页不退化，代价是没有总数、不能跳页。
 * 两轨都带 `?q=` 搜索词；具体筛选条件是领域语义，不进这个通用口袋。
 */

export const LIST_QUERY_KEY = 'q'
export const LIST_PAGE_KEY = 'page'
export const LIST_CURSOR_KEY = 'cursor'

export type OffsetListState = {
  query: string
  page: number
}

export type CursorListState = {
  query: string
  cursor: string
}

/** 读搜索词：缺失归零并去掉首尾空白，坏链接也要能打开。 */
function readQuery(params: URLSearchParams): string {
  return (params.get(LIST_QUERY_KEY) ?? '').trim()
}

/** 写搜索词：空词不落地址，保持链接干净；与列表无关的参数原样保留。 */
function writeQuery(out: URLSearchParams, query: string): void {
  if (query) {
    out.set(LIST_QUERY_KEY, query)
  } else {
    out.delete(LIST_QUERY_KEY)
  }
}

/** 读 offset 轨：缺失或非法页码一律回落第一页，绝不抛错。 */
export function readOffsetListState(params: URLSearchParams): OffsetListState {
  const raw = Number(params.get(LIST_PAGE_KEY))
  return { query: readQuery(params), page: Number.isInteger(raw) && raw > 0 ? raw : 1 }
}

/** 写 offset 轨：第一页不落地址。 */
export function writeOffsetListState(params: URLSearchParams, next: OffsetListState): URLSearchParams {
  const out = new URLSearchParams(params)
  writeQuery(out, next.query)
  if (next.page > 1) {
    out.set(LIST_PAGE_KEY, String(next.page))
  } else {
    out.delete(LIST_PAGE_KEY)
  }
  return out
}

/** 读游标轨：没有游标就是首页；游标对调用方是不透明串，这里只做去空白。 */
export function readCursorListState(params: URLSearchParams): CursorListState {
  return { query: readQuery(params), cursor: (params.get(LIST_CURSOR_KEY) ?? '').trim() }
}

/** 写游标轨：首页（空游标）不落地址。 */
export function writeCursorListState(params: URLSearchParams, next: CursorListState): URLSearchParams {
  const out = new URLSearchParams(params)
  writeQuery(out, next.query)
  if (next.cursor) {
    out.set(LIST_CURSOR_KEY, next.cursor)
  } else {
    out.delete(LIST_CURSOR_KEY)
  }
  return out
}

/**
 * 请求回的空页说明页码越界（深链粘了个太大的 page）：按总数算出最后一页。
 *
 * 不该回退时返回 null——不是空页、本来就没有数据、已在第一页、或页长非法，都应保持原状，
 * 免得把「真的没有数据」也当成越界来回跳。判断收在这里，页面与钩子都只剩调用。
 */
export function reconcilePage(input: { page: number; itemCount: number; total: number; size: number }): number | null {
  if (input.itemCount > 0 || input.total <= 0 || input.page <= 1 || input.size < 1) {
    return null
  }
  return Math.max(1, Math.ceil(input.total / input.size))
}
