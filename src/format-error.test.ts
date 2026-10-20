import { describe, expect, it } from 'vitest'
import type { Translator } from './contract'
import { createFormatError, errorCode, errorStatus } from './format-error'

const formatError = createFormatError('personal-notes')

const t: Translator = (key, values) => {
  const messages: Record<string, string> = {
    'personal-notes.error.RESOURCE_CONFLICT': '这条笔记已在别处改过',
    'personal-notes.error.detail': '[{code}] {message}',
    'personal-notes.error.unknown': '出错了',
  }
  const pattern = messages[key] ?? key
  if (!values) {
    return pattern
  }
  return pattern.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole))
}

describe('createFormatError', () => {
  it('目录有该码时用它，不暴露服务端原始 message', () => {
    expect(formatError({ status: 409, code: 'RESOURCE_CONFLICT', message: 'raw', requestId: 'r1' }, t)).toBe(
      '[RESOURCE_CONFLICT] 这条笔记已在别处改过',
    )
  })

  it('目录缺该码时回退服务端 message', () => {
    expect(formatError({ status: 400, code: 'BAD_INPUT', message: '参数不对', requestId: 'r2' }, t)).toBe(
      '[BAD_INPUT] 参数不对',
    )
  })

  it('缺该码且服务端没给 message 时回退错误码本身', () => {
    expect(formatError({ status: 400, code: 'BAD_INPUT', requestId: 'r3' }, t)).toBe('[BAD_INPUT] BAD_INPUT')
  })

  it('普通 Error 直接取其 message', () => {
    expect(formatError(new Error('网络断了'), t)).toBe('网络断了')
  })

  it('message 为空的 Error 与未知类型都回退未知文案', () => {
    expect(formatError(new Error(''), t)).toBe('出错了')
    expect(formatError('boom', t)).toBe('出错了')
  })
})

describe('errorCode / errorStatus', () => {
  it('从结构化形状里取业务码与状态码', () => {
    expect(errorCode({ status: 409, code: 'RESOURCE_CONFLICT', message: 'x', requestId: 'r' })).toBe(
      'RESOURCE_CONFLICT',
    )
    expect(errorStatus({ status: 409, code: 'RESOURCE_CONFLICT', message: 'x', requestId: 'r' })).toBe(409)
  })

  it('非接口错误一律给 null，页面据此区分「没权限」与「问不到」', () => {
    expect(errorCode(new Error('x'))).toBeNull()
    expect(errorCode(null)).toBeNull()
    expect(errorStatus('boom')).toBeNull()
    expect(errorStatus(undefined)).toBeNull()
  })

  it('缺 message/requestId 的形状仍可判定，不因可选字段而误判为普通错误', () => {
    expect(errorCode({ status: 403, code: 'AUTH_FORBIDDEN' })).toBe('AUTH_FORBIDDEN')
  })
})
