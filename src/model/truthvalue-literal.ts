import * as cir from '../cir'
import { Context, Expression, ValueSet } from '.'
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

    toCIRExpression(_: Context): cir.Expression {
        return { kind: 'TRUTHVALUE_LITERAL', value: this.value }
    }

    semantics(_: Context) {
        return 'COW' as const
    }

    valueSet(_: Context): ValueSet {
        return { type: 'truthvalue' }
    }

    isEffectivelyConst(_: Context): boolean {
        return true
    }
}
