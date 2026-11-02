import { BinaryOperator } from '@/model/binary-operation'
import { IntegerSet, ValueSet } from '@/model/value-set'
import { ErrorResult, Result } from '@/tools/result'
import { realOperationResult } from './real-operation'

export class Addition implements BinaryOperator {
    static readonly instance = new Addition()

    compute(left: ValueSet, right: ValueSet): Result<ValueSet> {
        if (!(left instanceof IntegerSet && right instanceof IntegerSet))
            return realOperationResult(left, right)
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
