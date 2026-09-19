import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { SemanticResult, Success } from '@/tools/semantic-result'
import { Expression } from '.'
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

    isolationLevel(): Success<ISOLATED> {
        return SemanticResult.value(ISOLATED)
    }

    currentValue(): Success<TruthvalueLattice<[Value]>> {
        return SemanticResult.value(this.value)
    }

    declaredLattice(): Success<Lattice> {
        return SemanticResult.value(this.value)
    }

    toCIRExpression(): Success<
        cir.Expression & { kind: 'TRUTHVALUE_LITERAL' }
    > {
        return SemanticResult.value({
            kind: 'TRUTHVALUE_LITERAL',
            value: this.value.toCIR(),
        })
    }

    isEffectivelyConst(): Success<true> {
        return SemanticResult.true
    }
}
