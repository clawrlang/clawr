import { Expression } from '@/model'
import { ISOLATED } from '@/model/isolation-level'
import { IntegerSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result, SuccessResult } from '@/tools/result'
import * as cir from '@clawr/cir'

export class IntegerLiteral<Value extends bigint> implements Expression {
    get negated() {
        return IntegerLiteral.create({
            value: -(this.value.min as bigint),
            span: this.span,
        })
    }

    private constructor(
        public readonly value: IntegerSet<Value, Value>,
        public readonly span: SourceCodeSpan,
    ) {}

    static create<Value extends bigint>({
        value,
        span,
    }: {
        value: Value
        span: SourceCodeSpan
    }) {
        return new IntegerLiteral(
            IntegerSet.range({ min: value, max: value }),
            span,
        )
    }

    isolationLevel(): SuccessResult<ISOLATED> {
        return Result.value(ISOLATED)
    }

    currentValue(): SuccessResult<IntegerSet<Value, Value>> {
        return Result.value(this.value)
    }

    type(): SuccessResult<IntegerSet<Value, Value>> {
        return Result.value(this.value)
    }

    toCIRExpression(): SuccessResult<
        cir.Expression & { kind: 'INTEGER_LITERAL' }
    > {
        const type = this.value.toCIR()
        if (!('value' in type)) throw new Error('Expected singleton type')

        return Result.value({
            kind: 'INTEGER_LITERAL',
            type,
        })
    }

    isEffectivelyConst(): SuccessResult<true> {
        return Result.true
    }
}
