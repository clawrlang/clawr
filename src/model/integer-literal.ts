import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { SemanticResult, Success } from '@/tools/semantic-result'
import { Expression } from '.'
import { ISOLATED } from './isolation-level'
import { IntegerLattice } from './lattice'

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

    isolationLevel(): Success<ISOLATED> {
        return SemanticResult.value(ISOLATED)
    }

    currentValue(): Success<IntegerLattice<Value, Value>> {
        return SemanticResult.value(this.value)
    }

    declaredLattice(): Success<IntegerLattice<Value, Value>> {
        return SemanticResult.value(this.value)
    }

    toCIRExpression(): Success<cir.Expression & { kind: 'INTEGER_LITERAL' }> {
        return SemanticResult.value({
            kind: 'INTEGER_LITERAL',
            value: this.value.toCIR() as cir.Lattice & {
                type: 'integer'
                min: `${Value}`
                max: `${Value}`
            },
        })
    }

    isEffectivelyConst(): Success<true> {
        return SemanticResult.true
    }
}
