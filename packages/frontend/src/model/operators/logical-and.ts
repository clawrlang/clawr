import { truthvalue, TruthvalueSet, ValueSet } from '@/model/value-set'
import { ErrorResult, Result } from '@/tools/result'
import { BinaryOperator } from '../binary-operation'

export class LogicalAND implements BinaryOperator {
    static create() {
        return new LogicalAND()
    }

    compute(left: ValueSet, right: ValueSet): Result<ValueSet> {
        if (!(left instanceof TruthvalueSet && right instanceof TruthvalueSet))
            return ErrorResult.failure('Not logical types')

        const canBeFalse =
            left.values.includes('false') || right.values.includes('false')
        const canBeAmbiguous =
            (left.values.includes('ambiguous') &&
                right.values.includes('ambiguous')) ||
            (left.values.includes('ambiguous') &&
                right.values.includes('true')) ||
            (left.values.includes('true') && right.values.includes('ambiguous'))
        const canBeTrue =
            left.values.includes('true') && right.values.includes('true')

        const values: truthvalue[] = []
        if (canBeFalse) values.push('false')
        if (canBeAmbiguous) values.push('ambiguous')
        if (canBeTrue) values.push('true')
        return Result.value(TruthvalueSet.create(values))
    }
}
