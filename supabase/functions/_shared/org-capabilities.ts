export type ModuleState = {
  enabled?: boolean
}

export type OrgModuleMap = Record<string, ModuleState | undefined>

export function getOrgModules(config: any): OrgModuleMap {
  return (config?.platform_connections?.modules ?? {}) as OrgModuleMap
}

export function isModuleEnabled(config: any, moduleId: string): boolean {
  return getOrgModules(config)[moduleId]?.enabled !== false
}

export function areAmbassadorsEnabled(config: any): boolean {
  return isModuleEnabled(config, 'ambassadors')
}
