import { describe, expect, it } from 'vitest'
import {
  LIST_CURSOR_KEY,
  LIST_PAGE_KEY,
  LIST_QUERY_KEY,
  readCursorListState,
  readOffsetListState,
  reconcilePage,
  writeCursorListState,
  writeOffsetListState,
} from './list-query'

describe('readOffsetListState', () => {
  it('缺失时回落第一页与空搜索词', () => {
    expect(readOffsetListState(new URLSearchParams())).toEqual({ query: '', page: 1 })
  })

  it('读出搜索词与页码，搜索词去首尾空白', () => {
    expect(readOffsetListState(new URLSearchParams('q=%20abc%20&page=2'))).toEqual({ query: 'abc', page: 2 })
  })

  it('非法页码一律回落，坏链接也要能打开', () => {
    for (const raw of ['abc', '0', '-5', '1.5', '']) {
      expect(readOffsetListState(new URLSearchParams(`page=${raw}`)).page).toBe(1)
    }
  })

  it('重复参数取第一个', () => {
    expect(readOffsetListState(new URLSearchParams('page=2&page=3')).page).toBe(2)
  })
})

describe('writeOffsetListState', () => {
  it('第一页与空搜索词都不落地址，保持链接干净', () => {
    const out = writeOffsetListState(new URLSearchParams('q=abc&page=3'), { query: '', page: 1 })
    expect(out.has(LIST_QUERY_KEY)).toBe(false)
    expect(out.has(LIST_PAGE_KEY)).toBe(false)
  })

  it('只写需要落地的键', () => {
    expect(writeOffsetListState(new URLSearchParams(), { query: 'a', page: 1 }).get(LIST_QUERY_KEY)).toBe('a')
    expect(writeOffsetListState(new URLSearchParams(), { query: '', page: 2 }).get(LIST_PAGE_KEY)).toBe('2')
  })

  it('保留与列表无关的参数', () => {
    expect(writeOffsetListState(new URLSearchParams('tab=roles'), { query: 'a', page: 2 }).get('tab')).toBe('roles')
  })

  it('读回与写入一致，非 ASCII 搜索词也能往返', () => {
    const out = writeOffsetListState(new URLSearchParams('tab=roles'), { query: '笔记 1', page: 4 })
    expect(readOffsetListState(out)).toEqual({ query: '笔记 1', page: 4 })
  })
})

describe('readCursorListState / writeCursorListState', () => {
  it('无游标即首页', () => {
    expect(readCursorListState(new URLSearchParams()).cursor).toBe('')
  })

  it('空游标不落地址，非空游标可往返', () => {
    expect(writeCursorListState(new URLSearchParams('cursor=x'), { query: '', cursor: '' }).has(LIST_CURSOR_KEY)).toBe(
      false,
    )
    const out = writeCursorListState(new URLSearchParams(), { query: 'a', cursor: 'eyJpZCI6MX0' })
    expect(readCursorListState(out)).toEqual({ query: 'a', cursor: 'eyJpZCI6MX0' })
  })
})

describe('reconcilePage', () => {
  it('本页为空且总数不为零时，退回最后一页', () => {
    expect(reconcilePage({ page: 5, itemCount: 0, total: 25, size: 10 })).toBe(3)
  })

  it('总数不满一页时退到第一页', () => {
    expect(reconcilePage({ page: 9, itemCount: 0, total: 4, size: 10 })).toBe(1)
  })

  it('不是空页 / 真的没数据 / 已在第一页 / 页长非法，都不回退', () => {
    expect(reconcilePage({ page: 2, itemCount: 5, total: 25, size: 10 })).toBeNull()
    expect(reconcilePage({ page: 3, itemCount: 0, total: 0, size: 10 })).toBeNull()
    expect(reconcilePage({ page: 1, itemCount: 0, total: 25, size: 10 })).toBeNull()
    expect(reconcilePage({ page: 4, itemCount: 0, total: 25, size: 0 })).toBeNull()
  })
})
