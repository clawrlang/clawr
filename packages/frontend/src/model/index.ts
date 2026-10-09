import {
    AnyIsolationLevel,
    IsolationLevel,
    UNIQUE,
} from '@/model/isolation-level'
import { PropertyReference } from '@/model/property-reference'
import { Scope } from '@/model/scope'
import { ValueSet } from '@/model/value-set'
import { VariableReference } from '@/model/variable-reference'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { HighlightRecorder } from '@/tools/highlights'
import { SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export type Context = {
    scope: Scope
    highlightRecorder?: HighlightRecorder
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
): value is VariableReference | PropertyReference {
    return (
        value instanceof VariableReference || value instanceof PropertyReference
    )
}
