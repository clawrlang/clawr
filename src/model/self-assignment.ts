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

        const targetLattice = context.scope.selfVariable()?.lattice

        const explicitLatticeContext = {
            ...context,
            isolationLevel: SHARED,
            explicitLattice: targetLattice,
        }

        const latticeResult = this.value.currentValue(explicitLatticeContext)
        if (latticeResult.isError) return latticeResult
        const cirResults = this.emitCIRStatements(context)
        if (cirResults.isError) return cirResults

        const result = context.scope.setCurrentValue(
            'self',
            latticeResult.value,
        )
        return result.isError
            ? SemanticErrorResult.failure(result.error.message, this.span)
            : Result.ok
    }

    private emitCIRStatements(context: Context): SemanticResult {
        const explicitLatticeContext = {
            ...context,
            isolationLevel: SHARED,
            explicitLattice: context.scope.selfVariable()?.lattice,
        }
        const valueCIRResult = this.value.toCIRExpression({
            ...explicitLatticeContext,
            isolationLevel: explicitLatticeContext.isolationLevel,
        })
        if (valueCIRResult.isError) return valueCIRResult

        const { isolationLevel, ...value } = valueCIRResult.value

        context.scope.emitted.push({
            kind: 'SELF_ASSIGN',
            value: { ...value, kind: 'DATA' },
        })
        return Result.ok
    }

    private checkValidity(context: Context): SemanticResult {
        const targetLattice = context.scope.selfVariable()?.lattice
        if (!targetLattice) throw new Error('`self` variable not added')
        const explicitLatticeContext = {
            ...context,
            isolationLevel: SHARED,
            explicitLattice: targetLattice,
        }
        const assignedValueResult = this.value.currentValue(
            explicitLatticeContext,
        )
        if (assignedValueResult.isError) return assignedValueResult
        const assignedValue = assignedValueResult.value
        if (!targetLattice.isSupersetTo(assignedValue))
            return SemanticErrorResult.failure(
                `Cannot assign value of type ${assignedValue.toString()} to target of type ${targetLattice.toString()}`,
                this.span,
            )
        return Result.ok
    }
}
