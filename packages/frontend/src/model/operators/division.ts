import { IntegerRange, ValueSet } from '@/model/value-set'
import { ErrorResult, Result } from '@/tools/result'
import { BinaryOperator } from '../binary-operation'

export class Division implements BinaryOperator {
    static instance = new Division()

    compute(dividend: ValueSet, divisor: ValueSet): Result<ValueSet> {
        if (!(
            dividend instanceof IntegerRange && divisor instanceof IntegerRange
        ))
            return ErrorResult.failure(
                `division between ${dividend.toString()} and ${divisor.toString()} is not supported`,
            )

        if (divisor.min === 0n || divisor.max === 0n)
            return ErrorResult.failure('division by zero')

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

export function unionRange(
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
