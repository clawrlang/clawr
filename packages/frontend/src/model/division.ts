import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { AnyIsolationLevel, ISOLATED } from './isolation-level'
import { IntegerRange, ValueSet } from './value-set'

export class Division implements Expression {
    private constructor(
        private readonly numerator: Expression,
        private readonly denominator: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        numerator,
        denominator,
        span,
    }: {
        numerator: Expression
        denominator: Expression
        span: SourceCodeSpan
    }): Division {
        return new Division(numerator, denominator, span)
    }

    isEffectivelyConst(_: Context): SemanticResult<boolean> {
        return Result.true
    }
    isolationLevel(_: Context): SemanticResult<AnyIsolationLevel> {
        return Result.value(ISOLATED)
    }

    domain(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.numerator.domain(context),
            this.denominator.domain(context),
        ])
        if (collected.isError) return collected
        const [numerator, denominator] = collected.value
        return this.div(numerator, denominator)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.numerator.currentValue(context),
            this.denominator.currentValue(context),
        ])
        if (collected.isError) return collected
        const [numerator, denominator] = collected.value
        return this.div(numerator, denominator)
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression> {
        throw new Error('Method not implemented.')
    }

    private div(
        numerator: ValueSet,
        denominator: ValueSet,
    ): SemanticResult<ValueSet> {
        if (!(
            numerator instanceof IntegerRange &&
            denominator instanceof IntegerRange
        ))
            return SemanticErrorResult.failure(
                `division between ${numerator.toString()} and ${denominator.toString()} is not supported`,
                this.span,
            )

        const zeroIsAchievableDenominator =
            (denominator.min === undefined || denominator.min <= 0n) &&
            (denominator.max === undefined || denominator.max >= 0n)
        if (zeroIsAchievableDenominator)
            return SemanticErrorResult.failure('division by zero', this.span)

        const { min, max } = integerDivisionRange(numerator, denominator)
        return Result.value(IntegerRange.create({ min, max }))
    }
}

// Rounds towards negative infinity, matching Clawr's integer division semantics.
function floorDiv(n: bigint, d: bigint): bigint {
    const quotient = n / d
    const remainder = n % d
    return remainder !== 0n && remainder < 0n !== d < 0n
        ? quotient - 1n
        : quotient
}

// floorDiv(n, d) as d grows without bound towards +infinity.
function floorDivLimitPositiveDenominator(n: bigint): bigint {
    return n >= 0n ? 0n : -1n
}

// floorDiv(n, d) as d shrinks without bound towards -infinity.
function floorDivLimitNegativeDenominator(n: bigint): bigint {
    return n > 0n ? -1n : 0n
}

// Computes the exact range of floor(numerator / denominator), given that the
// denominator range is known not to contain zero (so it is entirely positive
// or entirely negative).
function integerDivisionRange(
    numerator: IntegerRange<bigint | undefined, bigint | undefined>,
    denominator: IntegerRange<bigint | undefined, bigint | undefined>,
): { min: bigint | undefined; max: bigint | undefined } {
    const nMin = numerator.min
    const nMax = numerator.max
    const isNegativeDenominator =
        denominator.max !== undefined && denominator.max < 0n

    const maxIsInfinite = isNegativeDenominator
        ? nMin === undefined
        : nMax === undefined
    const minIsInfinite = isNegativeDenominator
        ? nMax === undefined
        : nMin === undefined

    // The denominator bound nearest zero is always defined (the range can't
    // straddle zero); the bound farthest from zero may be unbounded, in
    // which case the quotient approaches (but can still attain) a limit.
    const dNear = (
        isNegativeDenominator ? denominator.max : denominator.min
    ) as bigint
    const dFar = isNegativeDenominator ? denominator.min : denominator.max

    const candidates: bigint[] = []
    for (const n of [nMin, nMax]) {
        if (n === undefined) continue
        candidates.push(floorDiv(n, dNear))
        candidates.push(
            dFar !== undefined
                ? floorDiv(n, dFar)
                : isNegativeDenominator
                  ? floorDivLimitNegativeDenominator(n)
                  : floorDivLimitPositiveDenominator(n),
        )
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
