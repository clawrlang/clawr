import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'

export class IntegerLiteral implements Expression {
    get negated(): IntegerLiteral {
        return new IntegerLiteral(-this.value, this.span)
    }

    private constructor(
        private value: bigint,
        public span: SourceCodeSpan,
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

    toCIRExpression(context: Context): cir.Expression {
        return {
            kind: 'INTEGER_LITERAL',
            value: this.value.toString(),
            valueSet: this.valueSet(context),
        }
    }

    semantics(_: Context) {
        return 'COW' as const
    }

    valueSet(_: Context): Extract<cir.ValueSet, { type: 'integer' }> {
        return {
            type: 'integer',
            min: this.value.toString(),
            max: this.value.toString(),
        }
    }

    isEffectivelyConst(_: Context): boolean {
        return true
    }
}
