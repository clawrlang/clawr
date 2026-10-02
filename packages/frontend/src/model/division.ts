import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { AnyIsolationLevel, ISOLATED } from './isolation-level'
import { IntegerRange, ValueSet } from './value-set'

export class Division implements Expression {
    private constructor(
        private readonly dividend: Expression,
        private readonly divisor: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        dividend,
        divisor,
        span,
    }: {
        dividend: Expression
        divisor: Expression
        span: SourceCodeSpan
    }): Division {
        return new Division(dividend, divisor, span)
    }

    isEffectivelyConst(_: Context): SemanticResult<boolean> {
        return Result.true
    }
    isolationLevel(_: Context): SemanticResult<AnyIsolationLevel> {
        return Result.value(ISOLATED)
    }

    domain(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.dividend.domain(context),
            this.divisor.domain(context),
        ])
        if (collected.isError) return collected
        const [dividend, divisor] = collected.value
        return this.div(dividend, divisor)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.dividend.currentValue(context),
            this.divisor.currentValue(context),
        ])
        if (collected.isError) return collected
        const [dividend, divisor] = collected.value
        return this.div(dividend, divisor)
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression> {
        throw new Error('Method not implemented.')
    }

    private div(
        dividend: ValueSet,
        divisor: ValueSet,
    ): SemanticResult<ValueSet> {
        if (!(
            dividend instanceof IntegerRange && divisor instanceof IntegerRange
        ))
            return SemanticErrorResult.failure(
                `division between ${dividend.toString()} and ${divisor.toString()} is not supported`,
                this.span,
            )

        if (divisor.min === 0n || divisor.max === 0n)
            return SemanticErrorResult.failure('division by zero', this.span)

        // A divisor range that merely spans zero (without having it as
        // an exact bound) can't divide by zero at runtime, but the result
        // is the union of what's achievable on either side of zero.
        const spansZero =
            (divisor.min === undefined || divisor.min < 0n) &&
            (divisor.max === undefined || divisor.max > 0n)

        const { min, max } = spansZero
            ? unionRange(
                  integerDivisionRange(
                      dividend,
                      IntegerRange.create({ min: divisor.min, max: -1n }),
                  ),
                  integerDivisionRange(
                      dividend,
                      IntegerRange.create({ min: 1n, max: divisor.max }),
                  ),
              )
            : integerDivisionRange(dividend, divisor)
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
function floorDivLimitPositiveDivisor(n: bigint): bigint {
    return n >= 0n ? 0n : -1n
}

// floorDiv(n, d) as d shrinks without bound towards -infinity.
function floorDivLimitNegativeDivisor(n: bigint): bigint {
    return n > 0n ? -1n : 0n
}

function unionRange(
    a: { min: bigint | undefined; max: bigint | undefined },
    b: { min: bigint | undefined; max: bigint | undefined },
): { min: bigint | undefined; max: bigint | undefined } {
    return {
        min:
            a.min === undefined || b.min === undefined
                ? undefined
                : a.min < b.min
                  ? a.min
                  : b.min,
        max:
            a.max === undefined || b.max === undefined
                ? undefined
                : a.max > b.max
                  ? a.max
                  : b.max,
    }
}

// Computes the exact range of floor(dividend / divisor), given that the
// divisor range is known not to contain zero (so it is entirely positive
// or entirely negative).
function integerDivisionRange(
    dividend: IntegerRange<bigint | undefined, bigint | undefined>,
    divisor: IntegerRange<bigint | undefined, bigint | undefined>,
): { min: bigint | undefined; max: bigint | undefined } {
    const nMin = dividend.min
    const nMax = dividend.max
    const isNegativeDivisor = divisor.max !== undefined && divisor.max < 0n

    const maxIsInfinite = isNegativeDivisor
        ? nMin === undefined
        : nMax === undefined
    const minIsInfinite = isNegativeDivisor
        ? nMax === undefined
        : nMin === undefined

    // The divisor bound nearest zero is always defined (the range can't
    // straddle zero); the bound farthest from zero may be unbounded, in
    // which case the quotient approaches (but can still attain) a limit.
    const dNear = (isNegativeDivisor ? divisor.max : divisor.min) as bigint
    const dFar = isNegativeDivisor ? divisor.min : divisor.max

    const candidates: bigint[] = []
    for (const n of [nMin, nMax]) {
        if (n === undefined) continue
        candidates.push(floorDiv(n, dNear))
        candidates.push(
            dFar !== undefined
                ? floorDiv(n, dFar)
                : isNegativeDivisor
                  ? floorDivLimitNegativeDivisor(n)
                  : floorDivLimitPositiveDivisor(n),
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
