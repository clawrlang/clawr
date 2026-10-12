import { BinaryOperator } from '@/model/binary-operation'
import { IntegerSet, ValueSet } from '@/model/value-set'
import { ErrorResult, Result } from '@/tools/result'

export class Addition implements BinaryOperator {
    static readonly instance = new Addition()

    compute(left: ValueSet, right: ValueSet): Result<ValueSet> {
        if (!(left instanceof IntegerSet && right instanceof IntegerSet))
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
        return Result.value(IntegerSet.range({ min, max }))
    }
}
