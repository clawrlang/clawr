import * as cir from '../cir'
import { ErrorReporter } from '../diagnostics'
import { VariableSemantics } from './variable-declaration'

export type Context = {
    scope: {
        variables: Map<string, Variable>
        declarations: Map<string, Declaration>
    }
    errorReporter: ErrorReporter
}

export type ValueSet = {
    type: string
}

export interface Expression {
    isEffectivelyConst(context: Context): boolean
    semantics(context: Context): 'COW' | 'REF' | 'UNIQUE'
    valueSet(context: Context): ValueSet
    toCIR(context: Context): cir.Expression
}

export interface Statement {
    toCIR(context: Context): cir.Statement
}

export interface Declaration {
    fields?: { name: string; type: string; semantics: VariableSemantics }[]
    toCIR(context: Context): cir.Declaration
}

type Variable = {
    semantics: VariableSemantics
    type: string
}
