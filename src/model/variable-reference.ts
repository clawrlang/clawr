import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { isFailure, SemanticResult } from '@/tools/semantic-result'
import { Context, Expression } from '.'
import { IsolationLevel, UNKNOWN } from './isolation-level'
import { Lattice } from './lattice'

export class VariableReference implements Expression {
    private constructor(
        public name: string,
        public span: SourceCodeSpan,
    ) {}

    static create({
        name,
        span,
    }: {
        name: string
        span: SourceCodeSpan
    }): VariableReference {
        return new VariableReference(name, span)
    }

    assignmentPrelude(context: Context): SemanticResult<cir.Statement[]> {
        const constResult = this.isEffectivelyConst(context)
        if (isFailure(constResult)) return constResult
        if (constResult.value)
            return SemanticResult.failure(
                `Variable ${this.name} is not mutable`,
                this.span,
            )
        return SemanticResult.value([])
    }

    isEffectivelyConst(context: Context): SemanticResult<boolean> {
        const variableResult = this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        return SemanticResult.value(variableResult.value.isImmutable)
    }

    isolationLevel(context: Context): SemanticResult<IsolationLevel | UNKNOWN> {
        const variableResult = this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        return SemanticResult.value(variableResult.value.isolationLevel)
    }

    declaredLattice(context: Context): SemanticResult<Lattice> {
        const variableResult = this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        return SemanticResult.value(variableResult.value.lattice)
    }

    currentValue(context: Context): SemanticResult<Lattice> {
        const result = context.scope.currentValue(this.name)
        if (!result) {
            return SemanticResult.failure(
                `Variable ${this.name} has no value in the current context`,
                this.span,
            )
        }
        return SemanticResult.value(result)
    }

    setCurrentValue(context: Context, value: Lattice): SemanticResult {
        const result = context.scope.setCurrentValue(this.name, value)
        if ('error' in result)
            return SemanticResult.failure(result.error.message, this.span)
        return SemanticResult.success
    }

    toCIRExpression(
        context: Context,
    ): SemanticResult<Extract<cir.Expression, { kind: 'VARIABLE_REF' }>> {
        const variableResult = this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        const valueResult = this.currentValue(context)
        if (isFailure(valueResult)) return valueResult
        return SemanticResult.value({
            kind: 'VARIABLE_REF' as const,
            name: this.name,
            value: valueResult.value.toCIR(),
        })
    }

    private lookupInScope(context: Context) {
        const variable = context.scope.variableDeclaration(this.name)
        if (!variable)
            return SemanticResult.failure(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        return SemanticResult.value(variable)
    }
}
