import { Expression } from '@/model'
import { ISOLATED } from '@/model/isolation-level'
import { RealSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result, SuccessResult } from '@/tools/result'
import * as cir from '@clawr/cir'
import { decimal, neg } from 'decimalish'

export class RealLiteral<Value extends decimal> implements Expression {
    get negated() {
        return RealLiteral.create({
            value: neg(this.value.min),
            span: this.span,
            source: this.source,
        })
    }

    private constructor(
        public readonly value: RealSet<Value, Value>,
        public readonly span: SourceCodeSpan,
        private readonly source: string,
    ) {}

    static create<Value extends decimal>({
        value,
        span,
        source = value.toString(),
    }: {
        value: Value
        span: SourceCodeSpan
        source?: string
    }) {
        const precision: cir.RealPrecision = {
            kind: 'sig',
            digits: significantDigits(source),
            base: 'dec',
        }
        return new RealLiteral(
            RealSet.range({ min: value, max: value, precision }),
            span,
            source,
        )
    }

    isolationLevel(): SuccessResult<ISOLATED> {
        return Result.value(ISOLATED)
    }

    currentValue(): SuccessResult<RealSet<Value, Value>> {
        return Result.value(this.value)
    }

    type(): SuccessResult<RealSet<Value, Value>> {
        return Result.value(this.value)
    }

    toCIRExpression(): SuccessResult<
        cir.Expression & { kind: 'REAL_LITERAL' }
    > {
        const type = this.value.toCIR()
        if (!('value' in type)) throw new Error('Expected singleton type')

        return Result.value({
            kind: 'REAL_LITERAL',
            type,
        })
    }

    isEffectivelyConst(): SuccessResult<true> {
        return Result.true
    }
}

function significantDigits(source: string): number {
    const coefficient = source.split(/[eE]/, 1)[0].replace(/[+-]/, '')
    const digits = coefficient.replace('.', '').replace(/^0+/, '')
    return Math.max(1, digits.length)
}
