/**
 * 类名拼接：只做「去掉假值再空格相连」这一件事。
 *
 * 不引 `classnames` 这类依赖是因为公共库要对 Remote 保持零额外运行时；
 * 也不把它从包根导出——它是基座内部的实现细节，消费方只面对组件。
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
