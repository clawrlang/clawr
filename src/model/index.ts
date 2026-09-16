import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, Result } from '@/tools/failable'
import { FieldReference } from './field-reference'
import { AnyIsolationLevel, IsolationLevel, UNIQUE } from './isolation-level'
import { Lattice } from './lattice'
import { Scope } from './scope'
import { VariableReference } from './variable-reference'

export type Context = {
    scope: Scope
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

    isEffectivelyConst(context: Context): Result<boolean>
    isolationLevel(context: Context): Result<AnyIsolationLevel>
    declaredLattice(context: ContextWithLattice): Result<Lattice>
    currentValue(context: ContextWithLattice): Result<Lattice>
    toCIRExpression(context: ContextWithLattice): Result<cir.Expression>

    setCurrentValue?(context: Context, value: Lattice): Result
}

export interface Statement {
    emitStatement(context: Context): Result
}

export interface Declaration {
    emitDeclaration(context: Context): Failable
}
export function isStorage(
    value: any,
): value is VariableReference | FieldReference {
    return value instanceof VariableReference || value instanceof FieldReference
}
