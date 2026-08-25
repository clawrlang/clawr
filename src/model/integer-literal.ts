import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { IntegerLattice, Lattice } from './lattice'
import { _Failable } from './failable'
import { ISOLATED } from './isolation-level'
import { Failable } from './gen-failable'

export class IntegerLiteral<Value extends bigint> implements Expression {
    get negated() {
        return IntegerLiteral.create({
            value: -(this.value.min as bigint),
            span: this.span,
        })
    }

    private constructor(
        public readonly value: IntegerLattice<Value, Value>,
        public readonly span: SourceCodeSpan,
    ) {}

    static create<Value extends bigint>({
        value,
        span,
    }: {
        value: Value
        span: SourceCodeSpan
    }) {
        return new IntegerLiteral(
            IntegerLattice.create({ min: value, max: value }),
            span,
        )
    }

    *isolationLevel(_: Context): Failable<ISOLATED> {
        return Failable.success(ISOLATED)
    }

    _isolationLevel(_: Context): _Failable<ISOLATED> {
        const result = Failable.do(() => this.isolationLevel(_))
        return _Failable.of(result)
    }

    *currentValue(_: Context): Failable<Lattice> {
        return Failable.success(this.value)
    }

    _currentValue(_: Context): _Failable<Lattice> {
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
            kind: 'INTEGER_LITERAL',
            value: this.value.toCIR() as cir.Lattice & {
                type: 'integer'
                min: `${Value}`
                max: `${Value}`
            },
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
