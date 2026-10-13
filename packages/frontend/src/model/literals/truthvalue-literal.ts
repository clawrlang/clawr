import { Expression } from '@/model'
import { ISOLATED } from '@/model/isolation-level'
import { TruthvalueSet, ValueSet, truthvalue } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result, SuccessResult } from '@/tools/result'
import * as cir from '@clawr/cir'

export class TruthValueLiteral<Value extends truthvalue> implements Expression {
    private constructor(
        public value: TruthvalueSet<[Value]>,
        public span: SourceCodeSpan,
    ) {}

    static create<Value extends truthvalue>({
        value,
        span,
    }: {
        value: Value
        span: SourceCodeSpan
    }) {
        return new TruthValueLiteral(TruthvalueSet.singleton(value), span)
    }

    isolationLevel(): SuccessResult<ISOLATED> {
        return Result.value(ISOLATED)
    }

    currentValue(): SuccessResult<TruthvalueSet<[Value]>> {
        return Result.value(this.value)
    }

    type(): SuccessResult<ValueSet> {
        return Result.value(this.value)
    }

    toCIRExpression(): SuccessResult<
        cir.Expression & { kind: 'TRUTHVALUE_LITERAL' }
    > {
        const type = this.value.toCIR()
        if (!('value' in type)) throw new Error('expected singleton type')

        return Result.value({
            kind: 'TRUTHVALUE_LITERAL',
            type,
        })
    }

    isEffectivelyConst(): SuccessResult<true> {
        return Result.true
    }
}
