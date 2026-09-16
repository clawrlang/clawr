import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, Result } from '@/tools/failable'
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

    *isolationLevel(_: Context): Failable<ISOLATED> {
        return Result.value(ISOLATED)
    }

    *currentValue(_: Context): Failable<TruthvalueLattice<[Value]>> {
        return Result.value(this.value)
    }

    *declaredLattice(_: Context): Failable<Lattice> {
        return Result.value(this.value)
    }

    *toCIRExpression(_: Context): Failable<cir.Expression> {
        return Result.value({
            kind: 'TRUTHVALUE_LITERAL',
            value: this.value.toCIR(),
        })
    }

    *isEffectivelyConst(_: Context): Failable<boolean> {
        return Result.true
    }
}
