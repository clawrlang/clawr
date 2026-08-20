import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { Lattice, Truthlattice } from './lattice'
import { Failable } from './failable'
import { ISOLATED } from './isolation-level'

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

    isolationLevel(_: Context): Failable<ISOLATED> {
        return Failable.success(ISOLATED)
    }

    currentValue(_: Context): Failable<Lattice> {
        return Failable.success(Truthlattice.create([this.value]))
    }

    declaredLattice(_: Context): Failable<Lattice> {
        return Failable.success(Truthlattice.create([this.value]))
    }

    toCIRExpression(_: Context): Failable<cir.Expression> {
        return Failable.success({
            kind: 'TRUTHVALUE_LITERAL',
            value: this.value,
        })
    }

    isEffectivelyConst(_: Context): Failable<boolean> {
        return Failable.success(true)
    }
}
