import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, Result, Success } from '@/tools/failable'
import { Context, Expression } from '.'
import { ISOLATED } from './isolation-level'
import { IntegerLattice, Lattice } from './lattice'

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

    *isolationLevel_obsolete(_: Context): Failable<ISOLATED> {
        return this.isolationLevel()
    }
    isolationLevel(): Success<ISOLATED> {
        return Result.value(ISOLATED)
    }

    *currentValue_obsolete(_: Context): Failable<Lattice> {
        return this.currentValue()
    }
    currentValue(): Success<IntegerLattice<Value, Value>> {
        return Result.value(this.value)
    }

    *declaredLattice_obsolete(_: Context): Failable<Lattice> {
        return this.declaredLattice()
    }
    declaredLattice(): Success<IntegerLattice<Value, Value>> {
        return Result.value(this.value)
    }

    *toCIRExpression_obsolete(_: Context): Failable<cir.Expression> {
        return this.toCIRExpression()
    }
    toCIRExpression(): Success<cir.Expression & { kind: 'INTEGER_LITERAL' }> {
        return Result.value({
            kind: 'INTEGER_LITERAL',
            value: this.value.toCIR() as cir.Lattice & {
                type: 'integer'
                min: `${Value}`
                max: `${Value}`
            },
        })
    }

    *isEffectivelyConst_obsolete(_: Context): Failable<boolean> {
        return this.isEffectivelyConst()
    }
    isEffectivelyConst(): Success<true> {
        return Result.true
    }
}
