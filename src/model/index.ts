import * as cir from '../cir'
import { ErrorReporter, SourceCodeSpan } from '../diagnostics'
import { VariableSemantics } from './variable-declaration'

export class Scope {
    public variables: Map<string, Variable> = new Map()
    public declarations: Map<string, Declaration> = new Map()
    public emitted: {
        declarations: cir.Declaration[]
        statements: cir.Statement[]
    } = { declarations: [], statements: [] }
    private nextTempVarCounter = 0

    private constructor(public parentScope?: Scope) {}

    static createRoot() {
        return new Scope()
    }

    createChildScope() {
        return new Scope(this)
    }

    nextTempVar() {
        return `__tempˇ${this.nextTempVarCounter++}`
    }
}

export type Context = {
    scope: Scope
    errorReporter: ErrorReporter
}

export type ValueSet = {
    type: string
}

export interface Expression {
    get span(): SourceCodeSpan
    isEffectivelyConst(context: Context): boolean
    semantics(context: Context): 'COW' | 'REF' | 'UNIQUE'
    valueSet(context: Context): ValueSet
    toCIRExpression(context: Context): cir.Expression
}

export interface Statement {
    emitStatement(context: Context): void
}

export interface Declaration {
    emitDeclaration(context: Context): void
}

type Variable = {
    semantics: VariableSemantics
    type: string
}

export function isReferenceCounted(type: string): boolean {
    return !['integer', 'truthvalue', 'string'].includes(type)
}
