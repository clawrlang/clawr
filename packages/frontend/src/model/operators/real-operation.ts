import { IntegerSet, RealSet, ValueSet } from '@/model/value-set'
import { ErrorResult, Result } from '@/tools/result'

export function realOperationResult(
    left: ValueSet,
    right: ValueSet,
): Result<ValueSet> {
    const real = left instanceof RealSet ? left : right
    const other = left instanceof RealSet ? right : left
    if (!(real instanceof RealSet) || !real.precision)
        return ErrorResult.failure('real arithmetic requires an explicit precision')

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
        return Result.value(
            RealSet.unconstrained({
                ...real.precision,
                digits: Math.max(real.precision.digits, other.precision.digits),
            }),
        )
    }

    if (
        other instanceof IntegerSet &&
        real.precision.kind === 'scale'
    )
        return Result.value(
            RealSet.unconstrained({
                ...real.precision,
                digits: Math.max(real.precision.digits, 0),
            }),
        )

    return ErrorResult.failure(
        'integer and significant-precision real arithmetic is not supported',
    )
}
