import * as cir from '../cir'
import { ErrorReporter, SourceCodeSpan } from '../diagnostics'
import { Failable } from './failable'
import { Lattice } from './lattice'
import { Scope } from './scope'

export type Context = {
    scope: Scope
    errorReporter: ErrorReporter
}

export interface Expression {
    get span(): SourceCodeSpan
    isEffectivelyConst(context: Context): boolean
    currentValue(context: Context): Failable<Lattice>
    setCurrentValue?(context: Context, value: Lattice): void
    toCIRExpression(
        context: Context & { targetValueSet?: cir.ValueSet },
    ): cir.Expression
}

export interface Statement {
    emitStatement(context: Context): void
}

export interface Declaration {
    emitDeclaration(context: Context): void
}
