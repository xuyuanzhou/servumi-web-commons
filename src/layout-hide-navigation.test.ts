import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { PortalPageProps } from './contract'
import { definePages } from './layout'
import type { MenuItem, PageGroupModule } from './page-table'

function props(): PortalPageProps {
  return {
    basePath: '/desktop/test-module',
    locale: 'zh-cn',
    formatMessage: (key) => key,
    request: async <T>() => ({ success: true, code: '0', msg: 'ok', data: undefined as T, traceId: 'r1' }),
    session: null,
  }
}

function makeGroups(): Record<string, PageGroupModule> {
  const page = () => Promise.resolve({ default: () => createElement('section', null, 'page') })
  return {
    './pages/main/router.ts': {
      default: {
        path: '/',
        pages: [
          { path: '/paths', label: 'paths', component: page },
          { path: '/review', label: 'review', component: page },
        ],
      },
    },
  }
}

const menu: MenuItem[] = [
  { key: '/paths', label: 'paths' },
  { key: '/review', label: 'review' },
]

describe('definePages', () => {
  it('can hide the module rail for single-column desktop shells', () => {
    const Pages = definePages(makeGroups(), {
      menu,
      navLabel: 'nav.practice',
      hideNavigation: true,
    })

    const html = renderToStaticMarkup(
      createElement(MemoryRouter, { initialEntries: ['/desktop/test-module/paths'] }, createElement(Pages, props())),
    )

    expect(html).not.toContain('servumi-module-rail')
  })
})
