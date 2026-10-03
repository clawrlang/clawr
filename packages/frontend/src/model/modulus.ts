import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { unionRange } from './division'
import { AnyIsolationLevel, ISOLATED } from './isolation-level'
import { IntegerRange, ValueSet } from './value-set'

export class Modulus implements Expression {
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
    }): Modulus {
        return new Modulus(dividend, divisor, span)
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
        return this.mod(dividend, divisor)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.dividend.currentValue(context),
            this.divisor.currentValue(context),
        ])
        if (collected.isError) return collected
        const [dividend, divisor] = collected.value
        return this.mod(dividend, divisor)
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression> {
        throw new Error('Method not implemented.')
    }

    private mod(
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

        const spansZero =
            (divisor.min === undefined || divisor.min < 0n) &&
            (divisor.max === undefined || divisor.max > 0n)

        const { min, max } = spansZero
            ? unionRange(
                  modRange(dividend, { min: 1n, max: divisor.max }),
                  modRange(dividend, { min: divisor.min, max: -1n }),
              )
            : modRange(dividend, divisor)
        return Result.value(IntegerRange.create({ min, max }))
    }
}

type Bounds = { min: bigint | undefined; max: bigint | undefined }

// Divisor ranges up to this many values are enumerated for exact bounds.
const ENUMERATION_LIMIT = 256n

const negate = (n: bigint | undefined) => (n === undefined ? undefined : -n)

// Floored modulus for a positive divisor: always in [0, d).
function floorMod(n: bigint, d: bigint): bigint {
    return ((n % d) + d) % d
}

// Range of `dividend % divisor` for a divisor range that excludes zero.
function modRange(dividend: Bounds, divisor: Bounds): Bounds {
    if (divisor.min !== undefined && divisor.min > 0n)
        return modPositiveDivisor(dividend, divisor.min, divisor.max)

    // n % d == -((-n) % -d)
    const negated = modPositiveDivisor(
        { min: negate(dividend.max), max: negate(dividend.min) },
        -(divisor.max as bigint),
        negate(divisor.min),
    )
    return { min: negate(negated.max), max: negate(negated.min) }
}

// Range of `dividend % d` for d in [a, b], with 1 <= a and b possibly unbounded.
function modPositiveDivisor(
    dividend: Bounds,
    a: bigint,
    b: bigint | undefined,
): Bounds {
    const { min: lo, max: hi } = dividend

    if (
        lo !== undefined &&
        hi !== undefined &&
        b !== undefined &&
        b - a < ENUMERATION_LIMIT
    ) {
        let min = b
        let max = 0n
        for (let d = a; d <= b; d++) {
            // Both ends in the same multiple of d: the dividend doesn't wrap.
            const wraps = lo - floorMod(lo, d) !== hi - floorMod(hi, d)
            const dMin = wraps ? 0n : floorMod(lo, d)
            const dMax = wraps ? d - 1n : floorMod(hi, d)
            if (dMin < min) min = dMin
            if (dMax > max) max = dMax
        }
        return { min, max }
    }

    // Sound but not necessarily tight.
    const upper = b === undefined ? undefined : b - 1n
    if (lo !== undefined && lo >= 0n) {
        if (hi !== undefined && hi < a) return { min: lo, max: hi }
        const max =
            hi === undefined
                ? upper
                : upper === undefined || hi < upper
                  ? hi
                  : upper
        return { min: 0n, max }
    }
    if (lo !== undefined && hi !== undefined && hi < 0n && -lo <= a)
        return { min: lo + a, max: b === undefined ? undefined : hi + b }
    return { min: 0n, max: upper }
}
