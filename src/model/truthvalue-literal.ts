import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { Lattice, TruthvalueLattice, truthvalue } from './lattice'
import { ISOLATED } from './isolation-level'
import { Failable } from './failable'

export class TruthValueLiteral<Value extends truthvalue> implements Expression {
    private constructor(
        public value: TruthvalueLattice<[Value]>,
        public span: SourceCodeSpan,
    ) {}

    static create<Value extends truthvalue>({
        value,
        span,
    }: {
        value: Value
        span: SourceCodeSpan
    }) {
        return new TruthValueLiteral(TruthvalueLattice.singleton(value), span)
    }

    *isolationLevel(_: Context): Failable<ISOLATED> {
        return Failable.success(ISOLATED)
    }

    *currentValue(_: Context): Failable<TruthvalueLattice<[Value]>> {
        return Failable.success(this.value)
    }

    *declaredLattice(_: Context): Failable<Lattice> {
        return Failable.success(this.value)
    }

    *toCIRExpression(_: Context): Failable<cir.Expression> {
        return Failable.success({
            kind: 'TRUTHVALUE_LITERAL',
            value: this.value.toCIR(),
        })
    }

    *isEffectivelyConst(_: Context): Failable<boolean> {
        return Failable.success(true)
    }
}
