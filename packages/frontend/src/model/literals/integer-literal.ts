import { Expression } from '@/model'
import { ISOLATED } from '@/model/isolation-level'
import { IntegerRange } from '@/model/value-set'
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
        public readonly value: IntegerRange<Value, Value>,
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
            IntegerRange.create({ min: value, max: value }),
            span,
        )
    }

    isolationLevel(): SuccessResult<ISOLATED> {
        return Result.value(ISOLATED)
    }

    currentValue(): SuccessResult<IntegerRange<Value, Value>> {
        return Result.value(this.value)
    }

    domain(): SuccessResult<IntegerRange<Value, Value>> {
        return Result.value(this.value)
    }

    toCIRExpression(): SuccessResult<
        cir.Expression & { kind: 'INTEGER_LITERAL' }
    > {
        return Result.value({
            kind: 'INTEGER_LITERAL',
            domain: this.value.toCIR() as cir.ValueSet & {
                type: 'integer'
                min: `${Value}`
                max: `${Value}`
            },
        })
    }

    isEffectivelyConst(): SuccessResult<true> {
        return Result.true
    }
}
