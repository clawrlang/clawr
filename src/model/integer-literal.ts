import { Expression, Context } from '.'
import * as cir from '../cir'

export class IntegerLiteral implements Expression {
    private constructor(private value: bigint) {}

    static create(value: bigint): IntegerLiteral {
        return new IntegerLiteral(value)
    }

    toCIR(_: Context): cir.Expression {
        return { kind: 'INTEGER_LITERAL', value: this.value.toString() }
    }

    type(_: Context): string {
        return 'integer'
    }
}
