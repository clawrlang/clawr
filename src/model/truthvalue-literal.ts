import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { Lattice, Truthlattice, truthvalue } from './lattice'
import { _Failable, SemanticErrorCollection } from './failable'
import { ISOLATED } from './isolation-level'
import { Failable, isSuccess } from './gen-failable'

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

    *isolationLevel(_: Context): Failable<ISOLATED> {
        return Failable.success(ISOLATED)
    }

    _isolationLevel(_: Context): _Failable<ISOLATED> {
        const result = Failable.do(() => this.isolationLevel(_))
        return _Failable.of(result)
    }

    *currentValue(_: Context): Failable<Truthlattice<[Value]>> {
        return Failable.success(this.value)
    }

    _currentValue(_: Context): _Failable<Truthlattice<[Value]>> {
        const result = Failable.do(() => this.currentValue(_))
        return _Failable.of(result)
    }

    *declaredLattice(_: Context): Failable<Lattice> {
        return Failable.success(this.value)
    }
    _declaredLattice(_: Context): _Failable<Lattice> {
        const result = Failable.do(() => this.declaredLattice(_))
        return _Failable.of(result)
    }

    *toCIRExpression(_: Context): Failable<cir.Expression> {
        return Failable.success({
            kind: 'TRUTHVALUE_LITERAL',
            value: this.value.toCIR(),
        })
    }

    _toCIRExpression(_: Context): _Failable<cir.Expression> {
        const result = Failable.do(() => this.toCIRExpression(_))
        return _Failable.of(result)
    }

    *isEffectivelyConst(_: Context): Failable<boolean> {
        return Failable.success(true)
    }

    _isEffectivelyConst(_: Context): _Failable<boolean> {
        const result = Failable.do(() => this.isEffectivelyConst(_))
        return _Failable.of(result)
    }
}
