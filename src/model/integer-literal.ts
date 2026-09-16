import * as cir from '@/cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { IntegerLattice, Lattice } from './lattice'
import { ISOLATED } from './isolation-level'
import { Failable, Result } from '@/tools/failable'

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
        return Result.value(ISOLATED)
    }

    *currentValue(_: Context): Failable<Lattice> {
        return Result.value(this.value)
    }

    *declaredLattice(_: Context): Failable<Lattice> {
        return Result.value(this.value)
    }

    *toCIRExpression(_: Context): Failable<cir.Expression> {
        return Result.value({
            kind: 'INTEGER_LITERAL',
            value: this.value.toCIR() as cir.Lattice & {
                type: 'integer'
                min: `${Value}`
                max: `${Value}`
            },
        })
    }

    *isEffectivelyConst(_: Context): Failable<boolean> {
        return Result.true
    }
}
