import {
    IntegerSet,
    RealSet,
    truthvalue,
    TruthvalueSet,
    ValueSet,
} from '@/model/value-set'
import { ErrorResult, Result } from '@/tools/result'
import { BinaryOperator } from '../binary-operation'

export class Comparison implements BinaryOperator {
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

    static readonly equals = new Comparison('==')
    static readonly doesNotEqual = new Comparison('!=')
    static readonly isSame = new Comparison('===')
    static readonly isNotSame = new Comparison('!==')
    static readonly isLessThan = new Comparison('<')
    static readonly isLessThanOrEqual = new Comparison('<=')
    static readonly isGreaterThan = new Comparison('>')
    static readonly isGreaterThanOrEqual = new Comparison('>=')

    private constructor(private readonly operator: Operator) {}

    compute(left: ValueSet, right: ValueSet): Result<ValueSet> {
        if (
            Comparison.isNumeric(left, right) &&
            Comparison.involvesReal(left, right)
        )
            return this.operator === '===' || this.operator === '!=='
                ? ErrorResult.failure('not supported')
                : Result.value(TruthvalueSet.create(['false', 'true']))
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
                return ErrorResult.failure('not supported')
        }
    }

    private static isNumeric(left: ValueSet, right: ValueSet) {
        const numeric = (v: ValueSet) =>
            v instanceof IntegerSet || v instanceof RealSet
        return numeric(left) && numeric(right)
    }

    // Real values are compared exactly at runtime; no range reasoning yet.
    private static involvesReal(left: ValueSet, right: ValueSet) {
        return left instanceof RealSet || right instanceof RealSet
    }

    private equals(left: ValueSet, right: ValueSet): Result<ValueSet> {
        if (left instanceof IntegerSet && right instanceof IntegerSet) {
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
            return ErrorResult.failure(
                `A(n) ${left.toString()} and a(n) ${right.toString()} can never be equal`,
            )
    }

    private areNotEqual(left: ValueSet, right: ValueSet): Result<ValueSet> {
        if (left instanceof IntegerSet && right instanceof IntegerSet) {
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
            return ErrorResult.failure(
                `A(n) ${left.toString()} and a(n) ${right.toString()} can never be equal`,
            )
    }

    private leftIsLess(left: ValueSet, right: ValueSet): Result<ValueSet> {
        if (left instanceof IntegerSet && right instanceof IntegerSet) {
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
            return ErrorResult.failure(
                `${left.toString()} and ${right.toString()} do not support ordering`,
            )
    }

    private leftIsLessOrEqual(
        left: ValueSet,
        right: ValueSet,
    ): Result<ValueSet> {
        if (left instanceof IntegerSet && right instanceof IntegerSet) {
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
            return ErrorResult.failure(
                `${left.toString()} and ${right.toString()} do not support ordering`,
            )
    }

    private leftIsGreater(left: ValueSet, right: ValueSet): Result<ValueSet> {
        if (left instanceof IntegerSet && right instanceof IntegerSet) {
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
            return ErrorResult.failure(
                `${left.toString()} and ${right.toString()} do not support ordering`,
            )
    }

    private leftIsGreaterOrEqual(
        left: ValueSet,
        right: ValueSet,
    ): Result<ValueSet> {
        if (left instanceof IntegerSet && right instanceof IntegerSet) {
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
            return ErrorResult.failure(
                `${left.toString()} and ${right.toString()} do not support ordering`,
            )
    }
}

type Operator = (typeof Comparison.operators)[number]
