import { Expression, Context, ValueSet } from '.'
import * as cir from '../cir'
import { SourceCodeSpan } from '../diagnostics'

export class FieldReference implements Expression {
    private constructor(
        private object: Expression,
        private field: string,
        private fieldSpan: SourceCodeSpan,
    ) {}

    static create({
        object,
        operator,
        field,
        fieldSpan,
    }: {
        object: Expression
        operator: '.' | '->'
        field: string
        fieldSpan: SourceCodeSpan
    }): FieldReference {
        return new FieldReference(object, field, fieldSpan)
    }

    allowAssignment(context: Context) {
        if (this.isEffectivelyConst(context))
            context.errorReporter.reportFatalError(
                `Cannot mutate field ${this.field} of a reference type object`,
                this.fieldSpan,
            )
    }

    isEffectivelyConst(context: Context): boolean {
        // TODO: The field is assumed to be `mut`. Add field semantics and handle other cases.
        if (this.object.semantics(context) === 'REF') return false

        return this.object.isEffectivelyConst(context)
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
