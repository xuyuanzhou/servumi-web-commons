import { theme, Typography } from 'antd'
import type { CSSProperties, ReactNode } from 'react'

export type AdminSurfaceProps = {
  title?: ReactNode
  description?: ReactNode
  extra?: ReactNode
  children: ReactNode
}

export type AdminToolbarProps = {
  filters?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}

/**
 * 管理端内容面：比默认 Card 更克制，保留秩序感，但不叠厚阴影与重边框。
 */
export function AdminSurface({ title, description, extra, children }: AdminSurfaceProps) {
  const { token } = theme.useToken()
  const hasHeader = title !== undefined || description !== undefined || extra !== undefined

  const rootStyle: CSSProperties = {
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    overflow: 'hidden',
  }
  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: token.margin,
    padding: `${token.padding}px ${token.paddingLG}px`,
    borderBottom: `1px solid ${token.colorSplit}`,
    background: token.colorBgContainer,
    flexWrap: 'wrap',
  }
  const titleWrapStyle: CSSProperties = {
    flex: '1 1 320px',
    minWidth: 0,
  }
  const bodyStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: token.marginLG,
    padding: token.paddingLG,
    minWidth: 0,
  }

  return (
    <section style={rootStyle}>
      {hasHeader ? (
        <div style={headerStyle}>
          <div style={titleWrapStyle}>
            {title === undefined ? null : (
              <Typography.Title level={5} style={{ margin: 0 }}>
                {title}
              </Typography.Title>
            )}
            {description === undefined ? null : (
              <Typography.Paragraph
                type="secondary"
                style={{ margin: title === undefined ? 0 : `${token.marginXXS}px 0 0` }}
              >
                {description}
              </Typography.Paragraph>
            )}
          </div>
          {extra === undefined ? null : <div>{extra}</div>}
        </div>
      ) : null}
      <div style={bodyStyle}>{children}</div>
    </section>
  )
}

/**
 * 管理页工具条：筛选、动作与状态提示分三块摆放，窄屏自动换行。
 */
export function AdminToolbar({ filters, actions, meta }: AdminToolbarProps) {
  const { token } = theme.useToken()

  const rootStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: token.margin,
    flexWrap: 'wrap',
    paddingBottom: token.padding,
    borderBottom: `1px solid ${token.colorSplit}`,
  }
  const filtersStyle: CSSProperties = {
    flex: '1 1 420px',
    minWidth: 0,
  }
  const actionsStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: token.marginSM,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  }
  const metaStyle: CSSProperties = {
    flexBasis: '100%',
    minWidth: 0,
  }

  return (
    <div style={rootStyle}>
      <div style={filtersStyle}>{filters}</div>
      <div style={actionsStyle}>{actions}</div>
      {meta === undefined ? null : <div style={metaStyle}>{meta}</div>}
    </div>
  )
}
