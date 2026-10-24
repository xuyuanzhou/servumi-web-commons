import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMMONS_VERSION, contractDrift, readHostContract, writeHostContract } from './contract-version'
import { definePortalModule } from './contract'

const HOST_GLOBAL = '__SERVUMI_HOST__'

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)[HOST_GLOBAL]
  vi.restoreAllMocks()
})

describe('COMMONS_VERSION', () => {
  it('取构建期注入的版本，而不是在源码里写死一份', () => {
    // 真值由 vitest.config.ts 的 define 注入，与消费方构建同一条路；未注入会退回空串。
    expect(COMMONS_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('宿主自述', () => {
  it('读写两侧共用同一个全局名，形状也一致', () => {
    const scope: Record<string, unknown> = {}

    writeHostContract({ commonsVersion: '0.2.0' }, scope)
    expect(scope[HOST_GLOBAL]).toEqual({ commonsVersion: '0.2.0' })
    expect(readHostContract(scope)).toEqual({ commonsVersion: '0.2.0' })
  })

  it('没有宿主时读到 null，不抛错', () => {
    expect(readHostContract({})).toBeNull()
    expect(readHostContract({ [HOST_GLOBAL]: 'not-an-object' })).toBeNull()
  })
})

describe('contractDrift', () => {
  it('两侧都有版本且不等才算漂移', () => {
    expect(contractDrift('0.2.0', '0.3.0')).toBe(true)
    expect(contractDrift('0.2.0', '0.2.0')).toBe(false)
  })

  it('任一侧未知（空串）不算漂移：拿不到版本号不等于版本对不上', () => {
    expect(contractDrift('', '0.3.0')).toBe(false)
    expect(contractDrift('0.2.0', '')).toBe(false)
    expect(contractDrift('', '')).toBe(false)
  })
})

describe('definePortalModule 的契约版本比对', () => {
  it('模块自述本包版本，供壳侧比对', () => {
    expect(definePortalModule({}).commonsVersion).toBe(COMMONS_VERSION)
  })

  it('与宿主版本不一致时告警一次，但仍照常装配', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    writeHostContract({ commonsVersion: '9.9.9' })

    const module = definePortalModule({ desktop: () => null })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('契约版本漂移')
    expect(module.desktop).toBeTypeOf('function')
  })

  it('与宿主版本一致，或没有宿主时不告警', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    writeHostContract({ commonsVersion: COMMONS_VERSION })
    definePortalModule({})
    expect(warn).not.toHaveBeenCalled()

    delete (globalThis as unknown as Record<string, unknown>)[HOST_GLOBAL]
    definePortalModule({})
    expect(warn).not.toHaveBeenCalled()
  })
})
