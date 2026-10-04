import { Context, ContextWithDomain, Expression } from '@/model'
import { AnyIsolationLevel, ISOLATED } from '@/model/isolation-level'
import {
    IntegerRange,
    truthvalue,
    TruthvalueSet,
    ValueSet,
} from '@/model/value-set'
import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export class Comparison implements Expression {
    static readonly operators = [
        '==',
        '===',
        '!=',
        '!==',
        '<',
        '>',
        '<=',
        '>=',
    ] as const

    private constructor(
        private readonly operator: Operator,
        private readonly left: Expression,
        private readonly right: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        operator,
        left,
        right,
        span,
    }: {
        operator: Operator
        left: Expression
        right: Expression
        span: SourceCodeSpan
    }): Comparison {
        return new Comparison(operator, left, right, span)
    }

    isEffectivelyConst(_: Context): SemanticResult<boolean> {
        return Result.true
    }

    isolationLevel(_: Context): SemanticResult<AnyIsolationLevel> {
        return Result.value(ISOLATED)
    }

    domain(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.left.domain(context),
            this.right.domain(context),
        ])
        if (collected.isError) return collected
        const [left, right] = collected.value
        return this.compare(left, right)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.left.currentValue(context),
            this.right.currentValue(context),
        ])
        if (collected.isError) return collected
        const [left, right] = collected.value
        return this.compare(left, right)
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression> {
        throw new Error('Method not implemented.')
    }

    private compare(left: ValueSet, right: ValueSet): SemanticResult<ValueSet> {
        switch (this.operator) {
            case '==':
                return this.equals(left, right)
            case '!=':
                return this.areNotEqual(left, right)
            case '<':
                return this.leftIsLess(left, right)
            case '<=':
                return this.leftIsLessOrEqual(left, right)
            case '>':
                return this.leftIsGreater(left, right)
            case '>=':
                return this.leftIsGreaterOrEqual(left, right)
            default:
                return SemanticErrorResult.failure('not supported', this.span)
        }
    }

    private equals(left: ValueSet, right: ValueSet): SemanticResult<ValueSet> {
        if (left instanceof IntegerRange && right instanceof IntegerRange) {
            const values: truthvalue[] =
                left.min !== left.max ||
                right.min !== right.max ||
                left.min === undefined ||
                right.min === undefined
                    ? ['false', 'true']
                    : left.min === right.min
                      ? ['true']
                      : ['false']
            return Result.value(TruthvalueSet.create(values))
        } else if (
            left instanceof TruthvalueSet &&
            right instanceof TruthvalueSet
        ) {
            const canBeTrue = left.values.some((l: truthvalue) =>
                right.values.some((r: truthvalue) => r === l),
            )
            const canBeFalse = left.values.some((l: truthvalue) =>
                right.values.some((r: truthvalue) => r !== l),
            )
            const values: truthvalue[] = []
            if (canBeFalse) values.push('false')
            if (canBeTrue) values.push('true')
            return Result.value(TruthvalueSet.create(values))
        } else
            return SemanticErrorResult.failure(
                `A(n) ${left.toString()} and a(n) ${right.toString()} can never be equal`,
                this.span,
            )
    }

    private areNotEqual(
        left: ValueSet,
        right: ValueSet,
    ): SemanticResult<ValueSet> {
        if (left instanceof IntegerRange && right instanceof IntegerRange) {
            const values: truthvalue[] =
                left.min !== left.max ||
                right.min !== right.max ||
                left.min === undefined ||
                right.min === undefined
                    ? ['false', 'true']
                    : left.min === right.min
                      ? ['false']
                      : ['true']
            return Result.value(TruthvalueSet.create(values))
        } else if (
            left instanceof TruthvalueSet &&
            right instanceof TruthvalueSet
        ) {
            const canBeTrue = left.values.some((l: truthvalue) =>
                right.values.some((r: truthvalue) => r !== l),
            )
            const canBeFalse = left.values.some((l: truthvalue) =>
                right.values.some((r: truthvalue) => r === l),
            )
            const values: truthvalue[] = []
            if (canBeFalse) values.push('false')
            if (canBeTrue) values.push('true')
            return Result.value(TruthvalueSet.create(values))
        } else
            return SemanticErrorResult.failure(
                `A(n) ${left.toString()} and a(n) ${right.toString()} can never be equal`,
                this.span,
            )
    }

    private leftIsLess(
        left: ValueSet,
        right: ValueSet,
    ): SemanticResult<ValueSet> {
        if (left instanceof IntegerRange && right instanceof IntegerRange) {
            const canBeTrue =
                left.min === undefined ||
                right.max === undefined ||
                left.min < right.max
            const canBeFalse =
                left.max === undefined ||
                right.min === undefined ||
                left.max >= right.min
            const values: truthvalue[] = []
            if (canBeFalse) values.push('false')
            if (canBeTrue) values.push('true')
            return Result.value(TruthvalueSet.create(values))
        } else
            return SemanticErrorResult.failure(
                `${left.toString()} and ${right.toString()} do not support ordering`,
                this.span,
            )
    }

    private leftIsLessOrEqual(
        left: ValueSet,
        right: ValueSet,
    ): SemanticResult<ValueSet> {
        if (left instanceof IntegerRange && right instanceof IntegerRange) {
            const canBeTrue =
                left.min === undefined ||
                right.max === undefined ||
                left.min <= right.max
            const canBeFalse =
                left.max === undefined ||
                right.min === undefined ||
                left.max > right.min
            const values: truthvalue[] = []
            if (canBeFalse) values.push('false')
            if (canBeTrue) values.push('true')
            return Result.value(TruthvalueSet.create(values))
        } else
            return SemanticErrorResult.failure(
                `${left.toString()} and ${right.toString()} do not support ordering`,
                this.span,
            )
    }

    private leftIsGreater(
        left: ValueSet,
        right: ValueSet,
    ): SemanticResult<ValueSet> {
        if (left instanceof IntegerRange && right instanceof IntegerRange) {
            const canBeTrue =
                left.max === undefined ||
                right.min === undefined ||
                left.max > right.min
            const canBeFalse =
                left.min === undefined ||
                right.max === undefined ||
                left.min <= right.max
            const values: truthvalue[] = []
            if (canBeFalse) values.push('false')
            if (canBeTrue) values.push('true')
            return Result.value(TruthvalueSet.create(values))
        } else
            return SemanticErrorResult.failure(
                `${left.toString()} and ${right.toString()} do not support ordering`,
                this.span,
            )
    }

    private leftIsGreaterOrEqual(
        left: ValueSet,
        right: ValueSet,
    ): SemanticResult<ValueSet> {
        if (left instanceof IntegerRange && right instanceof IntegerRange) {
            const canBeTrue =
                left.max === undefined ||
                right.min === undefined ||
                left.max >= right.min
            const canBeFalse =
                left.min === undefined ||
                right.max === undefined ||
                left.min < right.max
            const values: truthvalue[] = []
            if (canBeFalse) values.push('false')
            if (canBeTrue) values.push('true')
            return Result.value(TruthvalueSet.create(values))
        } else
            return SemanticErrorResult.failure(
                `${left.toString()} and ${right.toString()} do not support ordering`,
                this.span,
            )
    }
}

type Operator = (typeof Comparison.operators)[number]
