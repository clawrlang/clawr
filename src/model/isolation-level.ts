export type IsolationLevel = ISOLATED | SHARED
export type ISOLATED = 'ISOLATED'
export const ISOLATED = 'ISOLATED'
export type SHARED = 'SHARED'
export const SHARED = 'SHARED'

export type AnyIsolationLevel = IsolationLevel | UNIQUE | UNKNOWN
export type UNIQUE = 'UNIQUE'
export const UNIQUE = 'UNIQUE'
export type UNKNOWN = 'UNKNOWN'
export const UNKNOWN = 'UNKNOWN'
