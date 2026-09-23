import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import { Context, Statement } from '.'
import { DataLiteral } from './data-literal'
import { SHARED } from './isolation-level'

export class SelfAssignment implements Statement {
    private constructor(
        public value: DataLiteral,
        public span: SourceCodeSpan,
    ) {}

    static create({
        value,
        span,
    }: {
        value: DataLiteral
        span: SourceCodeSpan
    }) {
        return new SelfAssignment(value, span)
    }

    emitStatement(context: Context): SemanticResult {
        const validityResult = this.checkValidity(context)
        if (validityResult.isError) return validityResult

        const targetDomain = context.scope.selfVariable()?.domain

        const explicitDomainContext = {
            ...context,
            isolationLevel: SHARED,
            explicitDomain: targetDomain,
        }

        const valueResult = this.value.currentValue(explicitDomainContext)
        if (valueResult.isError) return valueResult
        const cirResults = this.emitCIRStatements(context)
        if (cirResults.isError) return cirResults

        const result = context.scope.setCurrentValue('self', valueResult.value)
        return result.isError
            ? SemanticErrorResult.failure(result.error.message, this.span)
            : Result.ok
    }

    private emitCIRStatements(context: Context): SemanticResult {
        const explicitDomainContext = {
            ...context,
            isolationLevel: SHARED,
            explicitDomain: context.scope.selfVariable()?.domain,
        }
        const valueCIRResult = this.value.toCIRExpression({
            ...explicitDomainContext,
            isolationLevel: explicitDomainContext.isolationLevel,
        })
        if (valueCIRResult.isError) return valueCIRResult

        const { isolationLevel, ...value } = valueCIRResult.value

        context.scope.emitted.push({
            kind: 'SELF_ASSIGN',

            value: {
                kind: 'DATA',
                fields: value.fields?.map((f) => ({
                    name: f.name,
                    value: f.value,
                })),
                value: value.value,
            },
        })
        return Result.ok
    }

    private checkValidity(context: Context): SemanticResult {
        const targetDomain = context.scope.selfVariable()?.domain
        if (!targetDomain) throw new Error('`self` variable not added')
        const explicitDomainContext = {
            ...context,
            isolationLevel: SHARED,
            explicitDomain: targetDomain,
        }
        const assignedValueResult = this.value.currentValue(
            explicitDomainContext,
        )
        if (assignedValueResult.isError) return assignedValueResult
        const assignedValue = assignedValueResult.value
        if (!targetDomain.isSupersetTo(assignedValue))
            return SemanticErrorResult.failure(
                `Cannot assign value of type ${assignedValue.toString()} to target of type ${targetDomain.toString()}`,
                this.span,
            )
        return Result.ok
    }
}
