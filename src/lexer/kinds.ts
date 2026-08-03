const PUNCTUATION = [
    '=',
    '(',
    ')',
    '{',
    '}',
    '[',
    ']',
    ',',
    '.',
    ';',
    ':',
    '@',
    '+=',
    '-=',
    '/=',
    '*=',
    '&&=',
    '||=',
    '&=',
    '|=',
    '<<=',
    '>>=',
    '[>',
    '|>',
    '=>',
] as const

const OPERATORS = [
    '+',
    '-',
    '*',
    '/',
    '%',
    '!',
    '&',
    '|',
    '~',
    '^',
    '<',
    '≤',
    '>',
    '≥',
    '.',
    '->',
    '...',
    '..',
    '..<',
    '&&',
    '||',
    '==',
    '===',
    '!=',
    '≠',
    '=\u0338', // Decomposed form of '≠' using U+0338 (COMBINING LONG SOLIDUS OVERLAY)
    '!==',
    '<=',
    '>=',
    '<<',
    '>>',
    '??',
    '?.',
] as const

const ALL_KW = [
    // Variable Semantics
    'const',
    'mut',
    'ref',
    'mutref',

    // Functions / methods / operators
    `func`,
    'pure',
    `operator`,

    // Types
    `enum`,
    'union',
    'data',
    'object',
    'service',
    'companion',
    'role',
    'trait',

    // Object-scoped variables
    `self`,
    `super`,

    // Object sections
    'inheritance',
    `mutating`,

    // Function modifiers
    'helper',
    'atomic',
    'concurrent',

    // Control flow
    `return`,
    // `continue`,
    // `break`,
    // `if`,
    // `else`,
    // `guard`,
    // `switch`,
    // `when`,
    // `is`,
    // `case`,
    // `do`,
    // `while`,
    // `for`,
    // `in`,
    // `and`,
    // `or`,
    // `throw`,
    // `throws`,
    // `try`,
    // `catch`,
] as const

const ALL_TRUTHVALUE_LITERALS = ['false', 'ambiguous', 'true'] as const

export type PunctuationSymbol = (typeof PUNCTUATION)[number]
export type Operator = (typeof OPERATORS)[number]
export type Keyword = (typeof ALL_KW)[number]
export type TruthvalueLiteral = (typeof ALL_TRUTHVALUE_LITERALS)[number]
export type Annotation = '@main'

export const punctuationSymbols = new Set(PUNCTUATION)
export const operators = new Set<string>(OPERATORS)
export const keywords = new Set<string>(ALL_KW)
export const punctuationChars = new Set<string>(
    [...PUNCTUATION, ...OPERATORS].flat(),
)
export const truthValues = new Set<string>(ALL_TRUTHVALUE_LITERALS)
