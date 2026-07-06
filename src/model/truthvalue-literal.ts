import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'

export class TruthValueLiteral implements Expression {
    private constructor(
        private value: 'false' | 'ambiguous' | 'true',
        public span: SourceCodeSpan,
    ) {}

    static create({
        value,
        span,
    }: {
        value: 'false' | 'ambiguous' | 'true'
        span: SourceCodeSpan
    }): TruthValueLiteral {
        return new TruthValueLiteral(value, span)
    }

    toCIRExpression(context: Context): cir.Expression {
        return {
            kind: 'TRUTHVALUE_LITERAL',
            value: this.value,
            valueSet: this.valueSet(context),
        }
    }

    valueSet(_: Context): Extract<cir.ValueSet, { type: 'truthvalue' }> {
        return { type: 'truthvalue', values: [this.value] }
    }

    isEffectivelyConst(_: Context): boolean {
        return true
    }
}
