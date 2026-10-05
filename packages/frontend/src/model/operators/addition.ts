import { BinaryOperator } from '@/model/binary-operation'
import { IntegerRange, ValueSet } from '@/model/value-set'
import { ErrorResult, Result } from '@/tools/result'

export class Addition implements BinaryOperator {
    static create(): Addition {
        return new Addition()
    }

    compute(left: ValueSet, right: ValueSet): Result<ValueSet> {
        if (!(left instanceof IntegerRange && right instanceof IntegerRange))
            return ErrorResult.failure(
                `addition between ${left.toString()} and ${right.toString()} is not supported`,
            )
        const min =
            left.min === undefined || right.min === undefined
                ? undefined
                : left.min + right.min
        const max =
            left.max === undefined || right.max === undefined
                ? undefined
                : left.max + right.max
        return Result.value(IntegerRange.create({ min, max }))
    }
}
