import {
    IntegerSingleton,
    RealSingleton,
    StringSingleton,
    truthvalue,
    TruthvalueSingleton,
} from './value-set.js'

export type Literal =
    StringLiteral | IntegerLiteral | RealLiteral | TruthvalueLiteral

type StringLiteral = {
    kind: 'STRING_LITERAL'
    type: StringSingleton
}

type IntegerLiteral<Value extends bigint = bigint> = {
    kind: 'INTEGER_LITERAL'
    type: IntegerSingleton<Value>
}
type RealLiteral<Value extends string = string> = {
    kind: 'REAL_LITERAL'
    type: RealSingleton<Value>
}

type TruthvalueLiteral<Value extends truthvalue = truthvalue> = {
    kind: 'TRUTHVALUE_LITERAL'
    type: TruthvalueSingleton<Value>
}
