import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { Lattice, TruthvalueLattice } from './lattice'

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

    currentValue(_: Context): Lattice {
        return TruthvalueLattice.create([this.value])
    }

    toCIRExpression(_: Context): cir.Expression {
        return {
            kind: 'TRUTHVALUE_LITERAL',
            value: this.value,
            valueSet: {
                type: 'truthvalue',
                values: [this.value],
            },
        }
    }

    isEffectivelyConst(_: Context): boolean {
        return true
    }
}
