import * as cir from '../cir'
import { Expression, Context, ValueSet } from '.'

export class IntegerLiteral implements Expression {
    get negated(): IntegerLiteral {
        return new IntegerLiteral(-this.value)
    }

    private constructor(private value: bigint) {}

    static create(value: bigint): IntegerLiteral {
        return new IntegerLiteral(value)
    }

    toCIR(_: Context): cir.Expression {
        return { kind: 'INTEGER_LITERAL', value: this.value.toString() }
    }

    semantics(context: Context) {
        return 'COW' as const
    }

    valueSet(_: Context): ValueSet {
        return { type: 'integer' }
    }
}
