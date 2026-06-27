import { Expression, Context, ValueSet } from '.'
import * as cir from '../cir'
import { SourceCodeSpan } from '../diagnostics'
import { convertSemantics } from './variable-reference'

export class FieldReference implements Expression {
    private constructor(
        private object: Expression,
        private operator: '.' | '->',
        private field: string,
        public span: SourceCodeSpan,
        private fieldSpan: SourceCodeSpan,
    ) {}

    static create({
        object,
        operator,
        field,
        span,
        fieldSpan,
    }: {
        object: Expression
        operator: '.' | '->'
        field: string
        span: SourceCodeSpan
        fieldSpan: SourceCodeSpan
    }): FieldReference {
        return new FieldReference(object, operator, field, span, fieldSpan)
    }

    allowAssignment(context: Context) {
        if (this.isEffectivelyConst(context))
            context.errorReporter.reportFatalError(
                `Cannot mutate field ${this.field} of a reference type object`,
                this.fieldSpan,
            )
    }

    isEffectivelyConst(context: Context): boolean {
        if (this.object.semantics(context) === 'REF') return false

        return this.object.isEffectivelyConst(context)
    }

    semantics(context: Context) {
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
        return convertSemantics(field.semantics)
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
        this.checkOperatorCompatibility(context)
        return {
            kind: 'FIELD_REF',
            object: this.object.toCIR(context),
            field: this.field,
        }
    }

    private checkOperatorCompatibility(context: Context) {
        const semantics = this.object.semantics(context)
        if ((semantics === 'REF') !== (this.operator === '->'))
            context.errorReporter.reportFatalError(
                `Cannot access field ${this.field} of a ${semantics} type object with "${this.operator}" operator`,
                this.fieldSpan,
            )
    }
}
