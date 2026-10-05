import { BinaryOperator } from '@/model/binary-operation'
import { IntegerRange, ValueSet } from '@/model/value-set'
import { ErrorResult, Result } from '@/tools/result'

export class Subtraction implements BinaryOperator {
    static create() {
        return new Subtraction()
    }

    compute(minuend: ValueSet, subtrahend: ValueSet): Result<ValueSet> {
        if (!(
            minuend instanceof IntegerRange &&
            subtrahend instanceof IntegerRange
        ))
            return ErrorResult.failure(
                `subtraction between ${minuend.toString()} and ${subtrahend.toString()} is not supported`,
            )
        const min: bigint | undefined =
            minuend.min === undefined || subtrahend.max === undefined
                ? undefined
                : (((minuend.min as bigint) - subtrahend.max) as bigint)
        const max: bigint | undefined =
            minuend.max === undefined || subtrahend.min === undefined
                ? undefined
                : (((minuend.max as bigint) - subtrahend.min) as bigint)
        return Result.value(IntegerRange.create({ min, max }))
    }
}
