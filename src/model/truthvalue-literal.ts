import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result, SuccessResult } from '@/tools/result'
import { Expression } from '.'
import { ISOLATED } from './isolation-level'
import { TruthvalueSet, ValueSet, truthvalue } from './value-set'

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

    domain(): SuccessResult<ValueSet> {
        return Result.value(this.value)
    }

    toCIRExpression(): SuccessResult<
        cir.Expression & { kind: 'TRUTHVALUE_LITERAL' }
    > {
        return Result.value({
            kind: 'TRUTHVALUE_LITERAL',
            value: this.value.toCIR(),
        })
    }

    isEffectivelyConst(): SuccessResult<true> {
        return Result.true
    }
}
