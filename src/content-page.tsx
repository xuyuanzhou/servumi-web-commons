import { theme, Typography } from 'antd'
import type { CSSProperties, ReactNode } from 'react'

export type StandardContentPageProps = {
  className?: string
  breadcrumb?: ReactNode
  title: ReactNode
  summary?: ReactNode
  extra?: ReactNode
  children: ReactNode
}

/**
 * 模块页的标准内容壳：统一标题、说明文与操作区的排布，让页面组件只管业务内容。
 *
 * 这层故意很薄，只收「页头长什么样」这件公共事实，不替模块决定表单、列表或 Tabs 的结构。
 * 这样既能借鉴行业里“布局与内容解耦”的做法，又不把页面写成另一套 schema 运行时。
 *
 * `breadcrumb` 是管理页才需要的槽位（「管理台 / 权限管理」这类位置提示）：业务模块页通常不传，
 * 管理页传一段 `Breadcrumb`。收在这里而不是另立一个「管理页头」组件，是因为页头只有一份事实，
 * 两个变体并存会让同一套骨架长成两副样子。
 */
export function StandardContentPage({
  className,
  breadcrumb,
  title,
  summary,
  extra,
  children,
}: StandardContentPageProps) {
  const { token } = theme.useToken()

  const rootStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: token.margin,
    minWidth: 0,
  }
  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: token.margin,
    flexWrap: 'wrap',
  }
  const titleWrapStyle: CSSProperties = {
    flex: '1 1 320px',
    minWidth: 0,
    maxWidth: 880,
  }
  const breadcrumbStyle: CSSProperties = {
    marginBlockEnd: token.marginXS,
    minWidth: 0,
  }
  const extraStyle: CSSProperties = {
    flex: '0 0 auto',
    maxWidth: '100%',
  }

  return (
    <div className={className} style={rootStyle}>
      <div style={headerStyle}>
        <div style={titleWrapStyle}>
          {breadcrumb === undefined ? null : <div style={breadcrumbStyle}>{breadcrumb}</div>}
          <Typography.Title level={4} style={{ marginBlockEnd: summary === undefined ? 0 : token.marginXXS }}>
            {title}
          </Typography.Title>
          {summary === undefined ? null : (
            <Typography.Paragraph type="secondary" style={{ marginBlockEnd: 0 }}>
              {summary}
            </Typography.Paragraph>
          )}
        </div>
        {extra === undefined ? null : <div style={extraStyle}>{extra}</div>}
      </div>
      {children}
    </div>
  )
}
