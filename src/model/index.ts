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
    semantics(context: Context): 'ISOLATED' | 'SHARED' | 'UNIQUE'
    currentValue(context: Context): Failable<Lattice>
    setCurrentValue?(context: Context, value: Lattice): void
    toCIRExpression(
        context: Context & {
            type?: TypeName
            semantics?: 'ISOLATED' | 'SHARED'
        },
    ): Failable<cir.Expression>
}

export interface Statement {
    emitStatement(context: Context): void
}

export interface Declaration {
    emitDeclaration(context: Context): void
}
