import { Expression, Context, ValueSet } from '.'
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

    isEffectivelyConst(context: Context): boolean {
        // TODO: The field is assumed to be `mut`. Add field semantics and handle other cases.
        if (this.object.semantics(context) === 'REF') {
            return false
        } else {
            return this.object.isEffectivelyConst(context)
        }
    }

    semantics(context: Context) {
        return 'COW' as const
    }

    valueSet(context: Context): ValueSet {
        const objectInfo = this.object.valueSet(context)
        const declaration = context.scope.declarations.get(objectInfo.type)
        if (!declaration) {
            throw new Error(
                `Type ${objectInfo.type} is not defined in the current context`,
            )
        }
        if (!declaration.fields) {
            throw new Error(
                `Type ${objectInfo.type} is not a data type, cannot access fields`,
            )
        }
        const field = declaration.fields.find((f) => f.name === this.field)
        if (!field) {
            throw new Error(
                `Field ${this.field} does not exist on type ${objectInfo.type}`,
            )
        }
        return { type: field.type }
    }

    toCIR(context: Context): cir.FieldReference {
        return {
            kind: 'FIELD_REF',
            object: this.object.toCIR(context),
            field: this.field,
        }
    }
}
