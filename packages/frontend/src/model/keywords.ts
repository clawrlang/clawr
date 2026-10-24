export const MUTABILITY_KEYWORDS = ['const', 'mut'] as const
export const ISOLATION_KEYWORDS = ['ref', 'cow'] as const
export type MutabilityKeyword = (typeof MUTABILITY_KEYWORDS)[number]
export type IsolationKeyword = (typeof ISOLATION_KEYWORDS)[number]
