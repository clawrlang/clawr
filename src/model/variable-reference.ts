import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import { Context, Expression } from '.'
import { IsolationLevel, UNKNOWN } from './isolation-level'
import { ValueSet } from './value-set'

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
        if (constResult.isError) return constResult
        if (constResult.value)
            return SemanticErrorResult.failure(
                `Variable ${this.name} is not mutable`,
                this.span,
            )
        return Result.value([])
    }

    isEffectivelyConst(context: Context): SemanticResult<boolean> {
        const variableResult = this.lookupInScope(context)
        if (variableResult.isError) return variableResult
        return Result.value(variableResult.value.isImmutable)
    }

    isolationLevel(context: Context): SemanticResult<IsolationLevel | UNKNOWN> {
        const variableResult = this.lookupInScope(context)
        if (variableResult.isError) return variableResult
        return Result.value(variableResult.value.isolationLevel)
    }

    domain(context: Context): SemanticResult<ValueSet> {
        const variableResult = this.lookupInScope(context)
        if (variableResult.isError) return variableResult
        return Result.value(variableResult.value.domain)
    }

    currentValue(context: Context): SemanticResult<ValueSet> {
        const result = context.scope.currentValue(this.name)
        return result
            ? Result.value(result)
            : SemanticErrorResult.failure(
                  `Variable ${this.name} has no value in the current context`,
                  this.span,
              )
    }

    setCurrentValue(context: Context, value: ValueSet): SemanticResult {
        const result = context.scope.setCurrentValue(this.name, value)
        if ('error' in result)
            return SemanticErrorResult.failure(result.error.message, this.span)
        return Result.ok
    }

    toCIRExpression(
        context: Context,
    ): SemanticResult<Extract<cir.Expression, { kind: 'VARIABLE_REF' }>> {
        const variableResult = this.lookupInScope(context)
        if (variableResult.isError) return variableResult
        const valueResult = this.currentValue(context)
        if (valueResult.isError) return valueResult
        return Result.value({
            kind: 'VARIABLE_REF' as const,
            name: this.name,
            value: valueResult.value.toCIR(),
        })
    }

    private lookupInScope(context: Context) {
        const variable = context.scope.variableDeclaration(this.name)
        if (!variable)
            return SemanticErrorResult.failure(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        return Result.value(variable)
    }
}
