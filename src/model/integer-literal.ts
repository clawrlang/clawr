import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result, SuccessResult } from '@/tools/result'
import { Expression } from '.'
import { ISOLATED } from './isolation-level'
import { IntegerRange } from './value-set'

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
            value: this.value.toCIR() as cir.ValueSet & {
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
