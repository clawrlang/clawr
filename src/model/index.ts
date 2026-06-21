import * as cir from '../cir'

export interface Expression {
    toCir(): cir.Expression
}

export class TruthValueLiteral implements Expression {
    private constructor(private value: 'false' | 'ambiguous' | 'true') {}

    static create(value: 'false' | 'ambiguous' | 'true'): TruthValueLiteral {
        return new TruthValueLiteral(value)
    }

    toCir(): cir.Expression {
        return { type: 'TRUTHVALUE_LITERAL', value: this.value }
    }
}

export class IntegerLiteral implements Expression {
    private constructor(private value: bigint) {}

    static create(value: bigint): IntegerLiteral {
        return new IntegerLiteral(value)
    }

    toCir(): cir.Expression {
        return { type: 'INTEGER_LITERAL', value: this.value.toString() }
    }
}
