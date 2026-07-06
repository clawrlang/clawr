import { Context, Expression } from '.'
import * as cir from '../cir'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration } from './data-declaration'
import { convertSemantics } from './variable-reference'

export class FieldReference implements Expression {
    private constructor(
        public object: Expression,
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

    assignmentPrelude(context: Context): cir.Statement[] {
        if (this.isEffectivelyConst(context))
            context.errorReporter.reportFatalError(
                `Cannot mutate field ${this.field} of a reference type object`,
                this.span,
            )

        if ((this.object.valueSet(context) as any).semantics === 'COW') {
            return [
                {
                    kind: 'ENSURE_UNIQUE',
                    object: this.object.toCIRExpression({
                        ...context,
                        targetValueSet: this.object.valueSet(context),
                    }),
                },
            ]
        }
        return []
    }

    isEffectivelyConst(context: Context): boolean {
        if ((this.object.valueSet(context) as any).semantics === 'REF')
            return false

        return this.object.isEffectivelyConst(context)
    }

    valueSet(context: Context): cir.ValueSet {
        const field = this.getFieldFromContext(context)
        switch (field.type) {
            case 'integer':
            case 'truthvalue':
            case 'string':
                return { type: field.type }
            default:
                return {
                    type: 'rc-type',
                    typeName: field.type,
                    semantics: convertSemantics(field.semantics),
                }
        }
    }

    updateCurrentValue() {}

    toCIRExpression(
        context: Context,
    ): Extract<cir.Expression, { kind: 'FIELD_REF' }> {
        this.checkOperatorCompatibility(context)
        return {
            kind: 'FIELD_REF',
            object: this.object.toCIRExpression({
                ...context,
                targetValueSet: this.object.valueSet(context),
            }),
            field: this.field,
            valueSet: this.valueSet(context),
        }
    }

    private getFieldFromContext(context: Context) {
        const objectValueSet = this.object.valueSet(context)
        const objectType =
            objectValueSet.type === 'rc-type'
                ? objectValueSet.typeName
                : objectValueSet.type
        const declaration = context.scope.dataDeclaration(objectType)
        if (!declaration) {
            context.errorReporter.reportFatalError(
                `Type ${objectType} is not defined in the current context`,
                this.span,
            )
        }
        if (!(declaration instanceof DataDeclaration)) {
            context.errorReporter.reportFatalError(
                `Type ${objectType} is not a data type, cannot access fields`,
                this.span,
            )
        }
        const field = declaration.fields.find((f) => f.name === this.field)
        if (!field) {
            context.errorReporter.reportFatalError(
                `Field ${this.field} does not exist on type ${objectType}`,
                this.fieldSpan,
            )
        }
        return field
    }

    private checkOperatorCompatibility(context: Context) {
        const semantics = (this.object.valueSet(context) as any).semantics
        if ((semantics === 'REF') !== (this.operator === '->'))
            context.errorReporter.reportFatalError(
                `Cannot access field ${this.field} of a ${semantics} type object with "${this.operator}" operator`,
                this.span,
            )
    }
}
