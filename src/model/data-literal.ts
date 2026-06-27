import * as cir from '../cir'
import { Expression, Context, ValueSet } from '.'

export class DataLiteral implements Expression {
    private constructor(private fields: FieldValue[]) {}

    static create(fields: FieldValue[]): DataLiteral {
        return new DataLiteral(fields)
    }

    isEffectivelyConst(_: Context): boolean {
        return true
    }

    semantics(_: Context) {
        return 'UNIQUE' as const
    }

    valueSet(context: Context & { type: string }): ValueSet {
        return { type: context.type }
    }

    toCIR(context: Context): cir.Expression {
        return {
            kind: 'DATA_LITERAL',
            fields: this.fields.map((field) => ({
                name: field.name,
                value: field.value.toCIR(context),
            })),
        }
    }
}

type FieldValue = {
    name: string
    value: Expression
}
