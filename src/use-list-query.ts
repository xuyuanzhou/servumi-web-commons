/**
 * 列表页地址栏状态的 React 粘合层：只把「读 URL / 写 URL / 地址没变也要重取」收成一份。
 *
 * 真正的规则在 `list-query.ts`（纯函数，可单测），所以这里没有分支逻辑；各页面因此不必再
 * 各写一遍 `useSearchParams`、越界回退与「点了分页却没反应」的重取兜底。
 */
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  readCursorListState,
  readOffsetListState,
  reconcilePage,
  writeCursorListState,
  writeOffsetListState,
  type CursorListState,
  type OffsetListState,
} from './list-query'

/** offset 轨（小表 / 治理表）：页码 + 搜索词。 */
export type OffsetListQuery = {
  query: string
  page: number
  /** 重取计数：地址没变时自增。页面把它放进取数 effect 的依赖即可。 */
  reloadKey: number
  /** 按当前状态合并写回地址；目标地址与当前一致（如保存后刷新同一页）时改为自增 reloadKey。 */
  apply: (next: Partial<OffsetListState>) => void
  /** 取数落地后调用：本页为空且总数不为零时退回最后一页，免得「有数据却显示空」。 */
  reconcile: (input: { itemCount: number; total: number; size: number }) => void
}

export function useOffsetListQuery(): OffsetListQuery {
  const [params, setParams] = useSearchParams()
  const [reloadKey, setReloadKey] = useState(0)
  const state = readOffsetListState(params)
  const { query, page } = state

  const apply = useCallback(
    (next: Partial<OffsetListState>) => {
      const target = writeOffsetListState(params, { query, page, ...next })
      if (target.toString() === params.toString()) {
        setReloadKey((value) => value + 1)
        return
      }
      setParams(target)
    },
    [params, setParams, query, page],
  )

  const reconcile = useCallback(
    (input: { itemCount: number; total: number; size: number }) => {
      const lastPage = reconcilePage({ page, ...input })
      if (lastPage !== null) {
        setParams(writeOffsetListState(params, { query, page: lastPage }), { replace: true })
      }
    },
    [params, setParams, query, page],
  )

  return { query, page, reloadKey, apply, reconcile }
}

/** 游标轨（持续增长的大表）：游标 + 搜索词，没有页码也没有总数。 */
export type CursorListQuery = {
  query: string
  /** 空串表示首页；取值由服务端返回，前端只当不透明串透传。 */
  cursor: string
  reloadKey: number
  /** 按当前状态合并写回地址；传 `{ cursor: '' }` 即回到首页。 */
  apply: (next: Partial<CursorListState>) => void
}

export function useCursorListQuery(): CursorListQuery {
  const [params, setParams] = useSearchParams()
  const [reloadKey, setReloadKey] = useState(0)
  const state = readCursorListState(params)
  const { query, cursor } = state

  const apply = useCallback(
    (next: Partial<CursorListState>) => {
      const target = writeCursorListState(params, { query, cursor, ...next })
      if (target.toString() === params.toString()) {
        setReloadKey((value) => value + 1)
        return
      }
      setParams(target)
    },
    [params, setParams, query, cursor],
  )

  return { query, cursor, reloadKey, apply }
}
