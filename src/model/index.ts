import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { SemanticResult } from '@/tools/semantic-result'
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

    isEffectivelyConst(context: Context): SemanticResult<boolean>
    isolationLevel(context: Context): SemanticResult<AnyIsolationLevel>
    declaredLattice(context: ContextWithLattice): SemanticResult<Lattice>
    currentValue(context: ContextWithLattice): SemanticResult<Lattice>
    toCIRExpression(context: ContextWithLattice): SemanticResult<cir.Expression>

    setCurrentValue?(context: Context, value: Lattice): SemanticResult
}

export interface Statement {
    emitStatement(context: Context): SemanticResult
}

export interface Declaration {
    emitDeclaration(context: Context): SemanticResult
}
export function isStorage(
    value: any,
): value is VariableReference | FieldReference {
    return value instanceof VariableReference || value instanceof FieldReference
}
