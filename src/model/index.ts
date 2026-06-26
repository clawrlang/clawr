import * as cir from '../cir'
import { ErrorReporter } from '../diagnostics'
import { VaribleKind } from './variable-declaration'

export type Context = {
    scope: {
        variables: Map<string, Variable>
        declarations: Map<string, Declaration>
    }
    errorReporter: ErrorReporter
}

export type ValueSet = {
    kind: 'COW' | 'REF' | 'UNIQUE'
    type: string
}

export interface Expression {
    valueSet(context: Context): ValueSet
    toCIR(context: Context): cir.Expression
}

export interface Statement {
    toCIR(context: Context): cir.Statement
}

export interface Declaration {
    fields?: { name: string; type: string }[]
    toCIR(context: Context): cir.Declaration
}

type Variable = {
    kind: VaribleKind
    type: string
}
