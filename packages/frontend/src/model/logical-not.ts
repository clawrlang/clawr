import { Context, ContextWithType, Expression } from '@/model'
import { ISOLATED } from '@/model/isolation-level'
import {
    FieldSet,
    truthvalue,
    TruthvalueSet,
    ValueSet,
} from '@/model/value-set'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export class LogicalNot implements Expression {
    private constructor(
        private readonly operator: '!' | '~',
        private readonly operand: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        operator,
        operand,
        span,
    }: {
        operator: '!' | '~'
        operand: Expression
        span: SourceCodeSpan
    }) {
        return new LogicalNot(operator, operand, span)
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
        if (
            !(type.value instanceof TruthvalueSet) &&
            !(type.value instanceof FieldSet)
        )
            return SemanticErrorResult.failure('Expected truthvalue', this.span)
        const operand = this.operand.toCIRExpression(context)
        if (operand.isError) return operand
        if (type.value instanceof FieldSet) {
            if (
                operand.value.type.universe !== 'bitfield' &&
                operand.value.type.universe !== 'tritfield'
            )
                return SemanticErrorResult.failure('Expected field', this.span)
            return Result.value({
                kind: 'FIELD_NOT',
                operand: operand.value as cir.Expression & {
                    type: cir.FieldSet
                },
                type: type.value.toCIR(),
            })
        }
        return Result.value({
            kind: 'NOT',
            operand: operand.value,
            type: type.value.toCIR(),
        })
    }

    private negate(result: SemanticResult<ValueSet>): SemanticResult<ValueSet> {
        if (result.isError) return result
        if (this.operator === '~')
            return result.value instanceof FieldSet
                ? result
                : SemanticErrorResult.failure(
                      'Pointwise negation requires a field',
                      this.operand.span,
                  )
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
