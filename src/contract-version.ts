/**
 * 契约版本指纹：壳与各 Remote 各持本包的一份副本（各自打包），副本版本一旦不同，
 * 装配点交换的槽位入参与模块对象形状就可能对不上，而这类错配在运行期只表现为
 * 「页面上某个字段莫名是空的」，很难倒推回版本。产物是跨仓、跨发布装配的，
 * 构建期拦不住，能带进运行期的唯一线索就是两边各自的版本号（见 ADR-0015）。
 *
 * 版本号只能在消费方打包时注入：本包是纯源码包（`exports` 直指 `src`，没有自己的构建步骤），
 * 自己产不出这个常量。约定构建期注入 `__COMMONS_VERSION__`；未注入时留空串——
 * 空串代表「未知」，判定方据此跳过比对，而不是伪报一个版本号。
 */
declare const __COMMONS_VERSION__: string

/** 本包版本；构建期由消费方 `vite.config.ts` 的 `define` 注入。空串表示未知。 */
export const COMMONS_VERSION: string = typeof __COMMONS_VERSION__ === 'string' ? __COMMONS_VERSION__ : ''

/** 宿主自述：壳在启动时写到全局上，Remote 随后装配时读它比对契约版本。 */
export type HostContract = {
  commonsVersion: string
}

/** 承载宿主自述的全局名。读写两侧共用这一个常量，避免各写一遍字符串而漂移。 */
const HOST_GLOBAL = '__SERVUMI_HOST__'

type HostScope = Record<string, unknown>

/** 默认作用域：浏览器里是 window；单测可显式传入替身，不去动真全局。 */
function defaultScope(): HostScope {
  return globalThis as unknown as HostScope
}

/** 读宿主自述；没有宿主（Remote 独立运行、单测）时返回 null。 */
export function readHostContract(scope: HostScope = defaultScope()): HostContract | null {
  const host = scope[HOST_GLOBAL]
  return typeof host === 'object' && host !== null ? (host as HostContract) : null
}

/** 写宿主自述：壳启动时调一次，供随后装配的 Remote 读取。 */
export function writeHostContract(host: HostContract, scope: HostScope = defaultScope()): void {
  scope[HOST_GLOBAL] = host
}

/**
 * 两侧契约版本是否不一致。任一侧为空（未知）时返回 false：
 * 拿不到版本号只说明那一侧不知道自己的版本，不构成「契约漂移」的证据。
 */
export function contractDrift(local: string, host: string): boolean {
  return local !== '' && host !== '' && local !== host
}
