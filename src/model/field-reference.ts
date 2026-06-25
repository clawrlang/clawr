import { Expression, Context } from '.'
import * as cir from '../cir'

export class FieldReference implements Expression {
    private constructor(
        private object: Expression,
        private field: string,
    ) {}

    static create({
        object,
        field,
    }: {
        object: Expression
        field: string
    }): FieldReference {
        return new FieldReference(object, field)
    }

    type(context: Context): string {
        const objectType = this.object.type(context)
        const declaration = context.scope.declarations.get(objectType)
        if (!declaration) {
            throw new Error(
                `Type ${objectType} is not defined in the current context`,
            )
        }
        if (!declaration.fields) {
            throw new Error(
                `Type ${objectType} is not a data type, cannot access fields`,
            )
        }
        const field = declaration.fields.find((f) => f.name === this.field)
        if (!field) {
            throw new Error(
                `Field ${this.field} does not exist on type ${objectType}`,
            )
        }
        return field.type
    }

    toCIR(context: Context): cir.FieldReference {
        return {
            kind: 'FIELD_REF',
            object: this.object.toCIR(context),
            field: this.field,
        }
    }
}
