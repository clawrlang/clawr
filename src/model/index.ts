import * as cir from '../cir'
import { ErrorReporter, SourceCodeSpan } from '../diagnostics'
import { FieldReference } from './field-reference'
import { Failable } from './failable'
import { AnyIsolationLevel, IsolationLevel, UNIQUE } from './isolation-level'
import { Lattice } from './lattice'
import { Scope } from './scope'
import { VariableReference } from './variable-reference'

export type Context = {
    scope: Scope
    errorReporter: ErrorReporter
    calleeResult?: {
        lattice: Lattice
        isolationLevel: IsolationLevel | UNIQUE
    }
}

export type ContextWithLattice = Context & {
    explicitLattice?: Lattice
    isolationLevel?: IsolationLevel
}

export interface Expression {
    get span(): SourceCodeSpan

    isEffectivelyConst(context: Context): Failable<boolean>
    isolationLevel(context: Context): Failable<AnyIsolationLevel>
    declaredLattice(context: ContextWithLattice): Failable<Lattice>
    currentValue(context: ContextWithLattice): Failable<Lattice>
    toCIRExpression(context: ContextWithLattice): Failable<cir.Expression>

    setCurrentValue?(context: Context, value: Lattice): Failable
}

export interface Statement {
    emitStatement(context: Context): Failable
}

export interface Declaration {
    emitDeclaration(context: Context): Failable
}
export function isStorage(
    value: any,
): value is VariableReference | FieldReference {
    return value instanceof VariableReference || value instanceof FieldReference
}
