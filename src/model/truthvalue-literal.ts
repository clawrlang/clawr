import { Expression, Context } from '.'
import * as cir from '../cir'

export class TruthValueLiteral implements Expression {
    private constructor(private value: 'false' | 'ambiguous' | 'true') {}

    static create(value: 'false' | 'ambiguous' | 'true'): TruthValueLiteral {
        return new TruthValueLiteral(value)
    }

    toCIR(_: Context): cir.Expression {
        return { kind: 'TRUTHVALUE_LITERAL', value: this.value }
    }

    type(_: Context): string {
        return 'truthvalue'
    }
}
