import { Expression } from '@/model'
import { ISOLATED } from '@/model/isolation-level'
import { StringSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result, SuccessResult } from '@/tools/result'
import * as cir from '@clawr/cir'

export class StringLiteral implements Expression {
    private constructor(
        public readonly value: string,
        public readonly span: SourceCodeSpan,
    ) {}

    static create(value: string, span: SourceCodeSpan) {
        return new StringLiteral(value, span)
    }

    isolationLevel() {
        return Result.value(ISOLATED)
    }
    isEffectivelyConst() {
        return Result.true
    }
    type() {
        return Result.value(StringSet.create())
    }
    currentValue() {
        return this.type()
    }
    toCIRExpression(): SuccessResult<
        Extract<cir.Expression, { kind: 'STRING_LITERAL' }>
    > {
        return Result.value({
            kind: 'STRING_LITERAL',
            type: { universe: 'string', value: this.value },
        })
    }
}
