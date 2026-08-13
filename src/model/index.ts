import * as cir from '../cir'
import { ErrorReporter, SourceCodeSpan } from '../diagnostics'
import { Failable } from './failable'
import { Lattice } from './lattice'
import { Scope } from './scope'
import { TypeName } from './type-name'

export type Context = {
    scope: Scope
    errorReporter: ErrorReporter
}

export interface Expression {
    get span(): SourceCodeSpan
    isEffectivelyConst(context: Context): Failable<boolean>
    semantics(context: Context): IsolationLevel
    declaredValueSet(context: Context): Failable<Lattice>
    currentValue(context: Context): Failable<Lattice>
    setCurrentValue?(context: Context, value: Lattice): void
    toCIRExpression(
        context: Context & {
            type?: TypeName
            semantics?: ResolvedIsolationLevel
        },
    ): Failable<cir.Expression>
}

export interface Statement {
    emitStatement(context: Context): void
}

export interface Declaration {
    emitDeclaration(context: Context): void
}

export type IsolationLevel = 'ISOLATED' | 'SHARED' | 'UNIQUE'
export type ResolvedIsolationLevel = 'ISOLATED' | 'SHARED'
