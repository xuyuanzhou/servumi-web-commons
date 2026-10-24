type ModuleDomain = 'platform' | 'learning' | 'knowledge' | 'personal' | 'organization' | 'shared'
type ModuleGroup = 'learn' | 'record' | 'org' | 'system'
type ModuleAudience = 'user' | 'admin' | 'both'
type PublicAccess = 'none' | 'read'
type LocalizedText = Record<string, string>

type ModulePaths = {
  desktop: string
  manage: string
  mobile: string
  publicDesktop?: string
  publicMobile?: string
}

type PortalRenderSlot = 'desktop' | 'manage' | 'mobile' | 'publicDesktop' | 'publicMobile'

type ModuleRemote = {
  type: 'federation'
  scope: string
  module: './module'
}

export type RuntimeModuleManifest = {
  schemaVersion: 3
  id: string
  domain: ModuleDomain
  title: LocalizedText
  summary: LocalizedText
  group: ModuleGroup
  order: number
  apiPrefix: string
  requireAuth: boolean
  audience: ModuleAudience
  publicAccess: PublicAccess
  paths: ModulePaths
  slots?: PortalRenderSlot[]
  version: string
  minShellVersion: string
  remote: ModuleRemote
}
