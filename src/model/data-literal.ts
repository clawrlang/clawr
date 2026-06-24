import { Expression, Context } from '.'
import * as cir from '../cir'

export class DataLiteral implements Expression {
    fields: FieldValue[] = []

    constructor(fields: FieldValue[]) {
        this.fields = fields
    }

    type(_: Context): string {
        throw new Error('not implemented')
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
