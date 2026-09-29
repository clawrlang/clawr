export type IsolationLevel = ISOLATED | SHARED
export type ISOLATED = 'ISOLATED'
export const ISOLATED = 'ISOLATED' as const
export type SHARED = 'SHARED'
export const SHARED = 'SHARED' as const

export type AnyIsolationLevel = IsolationLevel | UNIQUE | UNKNOWN
export type UNIQUE = 'UNIQUE'
export const UNIQUE = 'UNIQUE' as const
export type UNKNOWN = 'UNKNOWN'
export const UNKNOWN = 'UNKNOWN' as const
