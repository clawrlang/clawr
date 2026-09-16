import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, Result, Success } from '@/tools/failable'
import { Context, Expression } from '.'
import { ISOLATED } from './isolation-level'
import { Lattice, TruthvalueLattice, truthvalue } from './lattice'

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

    *isolationLevel_obsolete(_: Context): Failable<ISOLATED> {
        return this.isolationLevel()
    }
    isolationLevel(): Success<ISOLATED> {
        return Result.value(ISOLATED)
    }

    *currentValue_obsolete(_: Context): Failable<TruthvalueLattice<[Value]>> {
        return this.currentValue()
    }
    currentValue(): Success<TruthvalueLattice<[Value]>> {
        return Result.value(this.value)
    }

    *declaredLattice_obsolete(_: Context): Failable<Lattice> {
        return this.declaredLattice()
    }
    declaredLattice(): Success<Lattice> {
        return Result.value(this.value)
    }

    *toCIRExpression_obsolete(_: Context): Failable<cir.Expression> {
        return this.toCIRExpression()
    }
    toCIRExpression(): Success<
        cir.Expression & { kind: 'TRUTHVALUE_LITERAL' }
    > {
        return Result.value({
            kind: 'TRUTHVALUE_LITERAL',
            value: this.value.toCIR(),
        })
    }

    *isEffectivelyConst_obsolete(_: Context): Failable<boolean> {
        return this.isEffectivelyConst()
    }
    isEffectivelyConst(): Success<true> {
        return Result.true
    }
}
