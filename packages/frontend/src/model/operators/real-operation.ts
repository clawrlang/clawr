import { IntegerSet, RealSet, ValueSet } from '@/model/value-set'
import { ErrorResult, Result } from '@/tools/result'

export function realOperationResult(
    left: ValueSet,
    right: ValueSet,
): Result<ValueSet> {
    const real = left instanceof RealSet ? left : right
    const other = left instanceof RealSet ? right : left
    if (!(real instanceof RealSet) || !real.precision)
        return ErrorResult.failure(
            'real arithmetic requires an explicit precision',
        )

    if (other instanceof RealSet) {
        if (!other.precision)
            return ErrorResult.failure(
                'real arithmetic requires an explicit precision',
            )
        const adopting = adoptedLiteralPrecision(real, other)
        if (adopting) return Result.value(adopting)
        if (
            real.precision.kind !== other.precision.kind ||
            real.precision.base !== other.precision.base
        )
            return ErrorResult.failure(
                'arithmetic with different real precision kinds or bases is not supported',
            )
        const wider =
            other.precision.digits > real.precision.digits ? other : real
        const precision = { ...real.precision, digits: wider.precision!.digits }
        // Binary results stay in the (bounded) format of the wider operand;
        // overflow is checked at runtime.
        const bounded = [wider, real, other].find(
            (operand) => operand.min !== undefined && operand.max !== undefined,
        )
        if (precision.base === 'bin' && bounded)
            return Result.value(
                RealSet.range({
                    min: bounded.min,
                    max: bounded.max,
                    precision,
                }),
            )
        return Result.value(RealSet.unconstrained(precision))
    }

    // An integer converts to the real's precision (like `scale 0`), whatever its kind.
    if (
        other instanceof IntegerSet &&
        (real.precision.base === 'dec' ||
            real.precision.base === 'bin' ||
            real.precision.base === 'ter')
    )
        return Result.value(RealSet.unconstrained(real.precision))

    return ErrorResult.failure(
        'integers can only be combined with decimal, binary or ternary reals',
    )
}

// A decimal literal is exact, so it adopts the precision of the other operand
// (it is rounded to that precision when lowered).
function adoptedLiteralPrecision(
    left: RealSet,
    right: RealSet,
): ValueSet | undefined {
    const isLiteral = (v: RealSet) =>
        v.min !== undefined &&
        v.min === v.max &&
        v.precision?.kind === 'sig' &&
        v.precision.base === 'dec'
    const literal = isLiteral(left)
        ? left
        : isLiteral(right)
          ? right
          : undefined
    if (!literal) return undefined
    const other = literal === left ? right : left
    if (other === literal) return undefined
    const precision = other.precision!
    if (precision.kind === 'sig' && precision.base === 'dec') return undefined
    if (
        precision.base === 'bin' &&
        other.min !== undefined &&
        other.max !== undefined
    )
        return RealSet.range({ min: other.min, max: other.max, precision })
    return RealSet.unconstrained(precision)
}
