import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { IntegerLattice, Lattice } from './lattice'
import { ISOLATED } from './isolation-level'
import { Failable } from './failable'

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

    *currentValue(_: Context): Failable<Lattice> {
        return Failable.success(this.value)
    }

    *declaredLattice(_: Context): Failable<Lattice> {
        return Failable.success(this.value)
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

    *isEffectivelyConst(_: Context): Failable<boolean> {
        return Failable.success(true)
    }
}
