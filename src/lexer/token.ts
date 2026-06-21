import { SourceCodeSpan } from '../diagnostics'
import type {
    Annotation,
    Keyword,
    Operator,
    PunctuationSymbol,
    TruthvalueLiteral,
} from './kinds'
import { decimal } from 'decimalish'

export type Token =
    | NewlineToken
    | KeywordToken
    | AnnotationToken
    | IdentifierToken
    | RealLiteralToken
    | IntegerLiteralToken
    | TruthvalueLiteralToken
    | StringLiteralToken
    | RegexLiteralToken
    | PunctuationToken
    | OperatorToken

export type NewlineToken = {
    kind: 'NEWLINE'
} & SourceCodeSpan
export type KeywordToken = {
    kind: 'KEYWORD'
    keyword: Keyword
} & SourceCodeSpan
export type AnnotationToken = {
    kind: 'ANNOTATION'
    annotation: Annotation
} & SourceCodeSpan
export type IdentifierToken = {
    kind: 'IDENTIFIER'
    identifier: string
} & SourceCodeSpan
export type RealLiteralToken = {
    kind: 'REAL_LITERAL'
    value: decimal
    source: string
} & SourceCodeSpan
export type TruthvalueLiteralToken = {
    kind: 'TRUTHVALUE_LITERAL'
    value: TruthvalueLiteral
} & SourceCodeSpan
export type IntegerLiteralToken = {
    kind: 'INTEGER_LITERAL'
    value: bigint
} & SourceCodeSpan
export type StringLiteralToken = {
    kind: 'STRING_LITERAL'
    value: string
} & SourceCodeSpan
export type RegexLiteralToken = {
    kind: 'REGEX_LITERAL'
    pattern: string
    modifiers?: Set<string>
} & SourceCodeSpan
export type PunctuationToken = {
    kind: 'PUNCTUATION'
    symbol: PunctuationSymbol
} & SourceCodeSpan
export type OperatorToken = {
    kind: 'OPERATOR'
    operator: Operator
} & SourceCodeSpan
