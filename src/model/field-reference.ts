import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration } from './data-declaration'
import { CowTypeLattice, Lattice } from './lattice'
import { convertSemantics, VariableReference } from './variable-reference'

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

        if (
            this.object instanceof VariableReference ||
            this.object instanceof FieldReference
        ) {
            const object = this.object.toCIRExpression(context)
            if ((object.valueSet as any).semantics === 'COW') {
                return [{ kind: 'ENSURE_UNIQUE', object }]
            }
        }
        return []
    }

    isEffectivelyConst(context: Context): boolean {
        if (
            (this.object.toCIRExpression(context).valueSet as any).semantics ===
            'REF'
        )
            return false

        return this.object.isEffectivelyConst(context)
    }

    currentValue(context: Context): Lattice {
        const objectValue = this.object.currentValue(context)
        if (objectValue instanceof CowTypeLattice)
            return objectValue.fields[this.field]

        const field = this.getFieldFromContext(context)
        return field.valueSet.toLattice({
            ...context,
            semantics: convertSemantics(field.semantics),
        })
    }

    setCurrentValue(context: Context, value: Lattice) {
        const objectValue = this.object.currentValue(context)
        if (objectValue instanceof CowTypeLattice) {
            objectValue.fields[this.field] = value

            const object: Expression = this.object
            object.setCurrentValue?.(context, objectValue)
        }
    }

    toCIRExpression(
        context: Context,
    ): Extract<cir.Expression, { kind: 'FIELD_REF' }> {
        this.checkOperatorCompatibility(context)
        return {
            kind: 'FIELD_REF',
            object: this.object.toCIRExpression(context),
            field: this.field,
            valueSet: this.getFieldFromContext(context).valueSet.toCIR({
                semantics: convertSemantics(
                    this.getFieldFromContext(context).semantics,
                ),
            }),
        }
    }

    private getFieldFromContext(context: Context) {
        const objectValueSet = this.object.toCIRExpression(context).valueSet
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
        const semantics = (this.object.toCIRExpression(context).valueSet as any)
            .semantics
        if ((semantics === 'REF') !== (this.operator === '->'))
            context.errorReporter.reportFatalError(
                `Cannot access field ${this.field} of a ${semantics} type object with "${this.operator}" operator`,
                this.span,
            )
    }
}
