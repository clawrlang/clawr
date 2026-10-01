import { SourceCodeSpan } from '@/tools'
import { Result, SuccessResult } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { ISOLATED } from './isolation-level'
import { IntegerRange, ValueSet } from './value-set'

export class Exponential implements Expression {
    private constructor(
        public readonly base: Expression,
        public readonly exponent: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    public static create({
        base,
        exponent,
        span,
    }: {
        base: Expression
        exponent: Expression
        span: SourceCodeSpan
    }): Exponential {
        return new Exponential(base, exponent, span)
    }

    isEffectivelyConst(_: Context): SuccessResult<true> {
        return Result.true
    }

    isolationLevel(_: Context): SuccessResult<ISOLATED> {
        return Result.value(ISOLATED)
    }

    domain(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.base.domain(context),
            this.exponent.domain(context),
        ])
        if (collected.isError) return collected
        const [base, exponent] = collected.value
        return this.exp(base, exponent)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.base.currentValue(context),
            this.exponent.currentValue(context),
        ])
        if (collected.isError) return collected
        const [base, exponent] = collected.value
        return this.exp(base, exponent)
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression> {
        throw new Error('Method not implemented.')
    }

    private exp(base: ValueSet, exponent: ValueSet): SemanticResult<ValueSet> {
        if (!(base instanceof IntegerRange && exponent instanceof IntegerRange))
            return SemanticErrorResult.failure(
                `exponentiation between ${base} and ${exponent} is not supported`,
                this.span,
            )

        if (exponent.min === undefined || exponent.min < 0)
            return SemanticErrorResult.failure(
                'negative exponent is not supported for integers',
                this.span,
            )

        if (
            base.min === 0n &&
            base.max === 0n &&
            exponent.min === 0n &&
            exponent.max === 0n
        )
            return SemanticErrorResult.failure(
                'The expression always evaluates to 0^0',
                this.span,
            )

        const { min, max } = integerExponentRange(base, exponent)
        return Result.value(IntegerRange.create({ min, max }))
    }
}

// Whether the exponent range [eMin, eMax] contains an exponent >= minExp
// with the given parity (0n = even, 1n = odd; omitted = any parity).
function hasExponent(
    eMin: bigint,
    eMax: bigint | undefined,
    minExp: bigint,
    parity?: 0n | 1n,
): boolean {
    if (eMax === undefined) return true
    if (parity === undefined) return eMax >= minExp
    const largest = eMax % 2n === parity ? eMax : eMax - 1n
    return largest >= eMin && largest >= minExp
}

// Computes the exact range of base^exponent for integer ranges, where
// exponent.min is known to be defined and non-negative.
function integerExponentRange(
    base: IntegerRange<bigint | undefined, bigint | undefined>,
    exponent: IntegerRange<bigint | undefined, bigint | undefined>,
): { min: bigint | undefined; max: bigint | undefined } {
    const bMin = base.min
    const bMax = base.max
    const eMin = exponent.min as bigint
    const eMax = exponent.max

    const maxIsInfinite =
        (bMax === undefined && hasExponent(eMin, eMax, 1n)) ||
        (bMin === undefined && hasExponent(eMin, eMax, 2n, 0n)) ||
        (eMax === undefined && bMax !== undefined && bMax >= 2n) ||
        (eMax === undefined && bMin !== undefined && bMin <= -2n)
    const minIsInfinite =
        (bMin === undefined && hasExponent(eMin, eMax, 1n, 1n)) ||
        (eMax === undefined && bMin !== undefined && bMin <= -2n)

    // Candidate exponents: the bounds, plus the largest even and odd
    // exponents in range, since a negative base's extreme magnitude flips
    // sign depending on the parity of the exponent applied to it.
    const exponents: bigint[] = [eMin]
    if (eMax !== undefined) {
        exponents.push(eMax)
        const largestEven = eMax % 2n === 0n ? eMax : eMax - 1n
        if (largestEven >= eMin) exponents.push(largestEven)
        const largestOdd = eMax % 2n === 1n ? eMax : eMax - 1n
        if (largestOdd >= eMin && largestOdd >= 1n) exponents.push(largestOdd)
    }

    const candidates: bigint[] = []
    for (const b of [bMin, bMax])
        if (b !== undefined) for (const e of exponents) candidates.push(b ** e)

    const zeroIsAchievableBase =
        (bMin === undefined || bMin <= 0n) && (bMax === undefined || bMax >= 0n)
    if (zeroIsAchievableBase) {
        if (eMin === 0n) candidates.push(1n) // 0 ** 0
        if (eMax === undefined || eMax >= 1n) candidates.push(0n)
    }

    return {
        min: minIsInfinite
            ? undefined
            : candidates.reduce((a, b) => (a < b ? a : b)),
        max: maxIsInfinite
            ? undefined
            : candidates.reduce((a, b) => (a > b ? a : b)),
    }
}
