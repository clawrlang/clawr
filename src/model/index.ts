import * as cir from '../cir'
import { ErrorReporter, SourceCodeSpan } from '../diagnostics'
import { Lattice } from './lattice'
import { Scope } from './scope'

export type Context = {
    scope: Scope
    errorReporter: ErrorReporter
}

export interface Expression {
    get span(): SourceCodeSpan
    isEffectivelyConst(context: Context): boolean
    currentValue(context: Context): Lattice
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

export class SemanticError extends Error {
    private constructor(
        message: string,
        public span: SourceCodeSpan,
    ) {
        super(message)
    }

    static create({
        message,
        span,
    }: {
        message: string
        span: SourceCodeSpan
    }) {
        return new SemanticError(message, span)
    }
}

export function logSemanticError(
    message: string,
    {
        span,
        errorReporter,
    }: {
        span: SourceCodeSpan
        errorReporter: ErrorReporter
        fatal?: false
    },
): void
export function logSemanticError(
    message: string,
    {
        span,
        errorReporter,
        fatal,
    }: {
        span: SourceCodeSpan
        errorReporter: ErrorReporter
        fatal: true
    },
): never
export function logSemanticError(
    message: string,
    {
        span,
        errorReporter,
        fatal,
    }: {
        span: SourceCodeSpan
        errorReporter: ErrorReporter
        fatal?: boolean
    },
): void {
    errorReporter.reportError(message, span)
    if (fatal) throw SemanticError.create({ message, span })
}
