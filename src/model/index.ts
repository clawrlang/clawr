import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { SemanticResult } from '@/tools/semantic-result'
import { FieldReference } from './field-reference'
import { AnyIsolationLevel, IsolationLevel, UNIQUE } from './isolation-level'
import { Scope } from './scope'
import { ValueSet } from './value-set'
import { VariableReference } from './variable-reference'

export type Context = {
    scope: Scope
    calleeResult?: {
        domain: ValueSet
        isolationLevel: IsolationLevel | UNIQUE
    }
}

export type ContextWithDomain = Context & {
    explicitDomain?: ValueSet
    isolationLevel?: IsolationLevel
}

export interface Expression {
    get span(): SourceCodeSpan

    isEffectivelyConst(context: Context): SemanticResult<boolean>
    isolationLevel(context: Context): SemanticResult<AnyIsolationLevel>
    domain(context: ContextWithDomain): SemanticResult<ValueSet>
    currentValue(context: ContextWithDomain): SemanticResult<ValueSet>
    toCIRExpression(context: ContextWithDomain): SemanticResult<cir.Expression>

    setCurrentValue?(context: Context, value: ValueSet): SemanticResult
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
