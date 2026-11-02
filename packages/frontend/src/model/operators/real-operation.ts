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
        if (
            precision.base === 'bin' &&
            wider.min !== undefined &&
            wider.max !== undefined
        )
            return Result.value(
                RealSet.range({ min: wider.min, max: wider.max, precision }),
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
