import { Context, ContextWithType, Expression } from '@/model'
import { ISOLATED } from '@/model/isolation-level'
import { truthvalue, TruthvalueSet, ValueSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export class LogicalNot implements Expression {
    private constructor(
        private readonly operand: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        operand,
        span,
    }: {
        operand: Expression
        span: SourceCodeSpan
    }) {
        return new LogicalNot(operand, span)
    }

    isEffectivelyConst(context: Context): SemanticResult<boolean> {
        return this.operand.isEffectivelyConst(context)
    }

    isolationLevel() {
        return Result.value(ISOLATED)
    }

    type(context: ContextWithType): SemanticResult<ValueSet> {
        return this.negate(this.operand.type(context))
    }

    currentValue(context: ContextWithType): SemanticResult<ValueSet> {
        return this.negate(this.operand.currentValue(context))
    }

    toCIRExpression(context: ContextWithType): SemanticResult<cir.Expression> {
        const type = this.type(context)
        if (type.isError) return type
        if (!(type.value instanceof TruthvalueSet))
            return SemanticErrorResult.failure('Expected truthvalue', this.span)
        const operand = this.operand.toCIRExpression(context)
        if (operand.isError) return operand
        return Result.value({
            kind: 'NOT',
            operand: operand.value,
            type: type.value.toCIR(),
        })
    }

    private negate(result: SemanticResult<ValueSet>): SemanticResult<ValueSet> {
        if (result.isError) return result
        if (!(result.value instanceof TruthvalueSet))
            return SemanticErrorResult.failure(
                'Logical negation requires a truthvalue',
                this.operand.span,
            )
        const values: truthvalue[] = result.value.values.map(
            (value: truthvalue) =>
                value === 'true'
                    ? 'false'
                    : value === 'false'
                      ? 'true'
                      : 'ambiguous',
        )
        return Result.value(TruthvalueSet.create(values))
    }
}
