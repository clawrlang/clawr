import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'

export class IntegerLiteral implements Expression {
    get negated(): IntegerLiteral {
        return new IntegerLiteral(-this.value, this.span)
    }

    private constructor(
        public readonly value: bigint,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        value,
        span,
    }: {
        value: bigint
        span: SourceCodeSpan
    }): IntegerLiteral {
        return new IntegerLiteral(value, span)
    }

    toCIRExpression(_: Context): cir.Expression {
        return {
            kind: 'INTEGER_LITERAL',
            value: this.value.toString(),
            valueSet: {
                type: 'integer',
                min: this.value.toString(),
                max: this.value.toString(),
            },
        }
    }

    isEffectivelyConst(_: Context): boolean {
        return true
    }
}
