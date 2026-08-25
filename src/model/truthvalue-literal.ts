import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { Lattice, Truthlattice, truthvalue } from './lattice'
import { _Failable } from './failable'
import { ISOLATED } from './isolation-level'

export class TruthValueLiteral<Value extends truthvalue> implements Expression {
    private constructor(
        public value: Truthlattice<[Value]>,
        public span: SourceCodeSpan,
    ) {}

    static create<Value extends truthvalue>({
        value,
        span,
    }: {
        value: Value
        span: SourceCodeSpan
    }) {
        return new TruthValueLiteral(Truthlattice.singleton(value), span)
    }

    isolationLevel(_: Context): _Failable<ISOLATED> {
        return _Failable.success(ISOLATED)
    }

    currentValue(_: Context): _Failable<Lattice> {
        return _Failable.success(this.value)
    }

    declaredLattice(_: Context): _Failable<Lattice> {
        return _Failable.success(this.value)
    }

    toCIRExpression(_: Context): _Failable<cir.Expression> {
        return _Failable.success({
            kind: 'TRUTHVALUE_LITERAL',
            value: this.value.toCIR(),
        })
    }

    isEffectivelyConst(_: Context): _Failable<boolean> {
        return _Failable.success(true)
    }
}
