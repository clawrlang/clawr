import * as cir from '../cir'
import { ErrorReporter, SourceCodeSpan } from '../diagnostics'
import { Scope } from './scope'

export type Context = {
    scope: Scope
    errorReporter: ErrorReporter
}

export interface Expression {
    get span(): SourceCodeSpan
    isEffectivelyConst(context: Context): boolean
    valueSet(context: Context): cir.ValueSet
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
