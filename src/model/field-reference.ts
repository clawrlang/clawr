import * as cir from '../cir'
import { Context, Expression } from '.'
import {
    Failable,
    SemanticError,
    SemanticErrorCollection,
    logSemanticError,
} from './failable'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration } from './data-declaration'
import {
    IsolatedTypeLattice,
    Lattice,
    SharedTypeLattice,
    UniqueTypeLattice,
} from './lattice'
import { VariableReference } from './variable-reference'

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
        if (this.isEffectivelyConst(context).value())
            logSemanticError(
                `Cannot mutate field ${this.field} of a reference type object`,
                { ...context, span: this.span },
            )

        if (
            this.object instanceof VariableReference ||
            this.object instanceof FieldReference
        ) {
            const object = this.object.toCIRExpression(context).value()
            if ((object.valueSet as any).semantics === 'ISOLATED') {
                return [{ kind: 'ENSURE_UNIQUE', object }]
            }
        }
        return []
    }

    isEffectivelyConst(context: Context): Failable<boolean> {
        return this.object.toCIRExpression(context).map((object) => {
            if ((object.valueSet as any).semantics === 'SHARED')
                return Failable.success(false)
            return Failable.success(
                this.object.isEffectivelyConst(context).value(),
            )
        })
    }

    semantics(context: Context): 'ISOLATED' | 'SHARED' | 'UNIQUE' {
        const value = this.currentValue(context).value()
        if (value instanceof SharedTypeLattice) return 'SHARED'
        return 'ISOLATED'
    }

    currentValue(context: Context): Failable<Lattice> {
        const objectValue = this.object.currentValue(context).value()
        if (objectValue instanceof IsolatedTypeLattice)
            return Failable.success(objectValue.fields[this.field])

        const field = this.getFieldFromContext(context)
        return Failable.success(field.valueSet.toLattice(context))
    }

    setCurrentValue(context: Context, value: Lattice) {
        if (value instanceof UniqueTypeLattice)
            throw new Error(
                `Cannot set current value of field ${this.field} to a UniqueTypeLattice`,
            )
        const objectValue = this.object.currentValue(context).value()
        if (objectValue instanceof IsolatedTypeLattice) {
            objectValue.fields[this.field] = value

            const object: Expression = this.object
            object.setCurrentValue?.(context, objectValue)
        }
    }

    toCIRExpression(
        context: Context,
    ): Failable<Extract<cir.Expression, { kind: 'FIELD_REF' }>> {
        return this.checkOperatorCompatibility_failable(context).map((_) =>
            this.object.toCIRExpression(context).map((object) =>
                this.getFieldFromContext_failable(context).map((field) =>
                    Failable.success({
                        kind: 'FIELD_REF',
                        object,
                        field: this.field,
                        valueSet: field.valueSet.toCIR(),
                    }),
                ),
            ),
        )
    }

    private getFieldFromContext(context: Context) {
        const objectValueSet = this.object
            .toCIRExpression(context)
            .value().valueSet
        const objectType =
            objectValueSet.type === 'rc-type'
                ? objectValueSet.typeName
                : objectValueSet.type
        const declaration = context.scope.dataDeclaration(objectType)
        if (!declaration) {
            logSemanticError(
                `Type ${objectType} is not defined in the current context`,
                { ...context, span: this.span },
            )
        }
        if (!(declaration instanceof DataDeclaration)) {
            throw Failable.failure(
                `Type ${objectType} is not a data type, cannot access fields`,
                this.span,
            ).getError()
        }
        const field = declaration.fields.find((f) => f.name === this.field)
        if (!field) {
            throw Failable.failure(
                `Field ${this.field} does not exist on type ${objectType}`,
                this.fieldSpan,
            ).getError()
        }
        return field
    }

    private getFieldFromContext_failable(
        context: Context,
    ): Failable<DataDeclaration['fields'][number]> {
        return this.object.toCIRExpression(context).map((object) => {
            const objectValueSet = object.valueSet
            const objectType =
                objectValueSet.type === 'rc-type'
                    ? objectValueSet.typeName
                    : objectValueSet.type
            const declaration = context.scope.dataDeclaration(objectType)
            if (!declaration) {
                logSemanticError(
                    `Type ${objectType} is not defined in the current context`,
                    { ...context, span: this.span },
                )
            }
            if (!(declaration instanceof DataDeclaration)) {
                return Failable.failure(
                    `Type ${objectType} is not a data type, cannot access fields`,
                    this.span,
                )
            }
            const field = declaration.fields.find((f) => f.name === this.field)
            if (!field) {
                return Failable.failure(
                    `Field ${this.field} does not exist on type ${objectType}`,
                    this.fieldSpan,
                )
            }
            return Failable.success(field)
        })
    }

    private checkOperatorCompatibility_failable(context: Context): Failable {
        return this.object.toCIRExpression(context).map((object) => {
            const semantics = (object.valueSet as any).semantics
            if ((semantics === 'SHARED') !== (this.operator === '->')) {
                const error = SemanticError.create({
                    message: `Cannot access field ${this.field} of a ${semantics} type object with "${this.operator}" operator`,
                    span: this.span,
                })
                return Failable.failure(SemanticErrorCollection.create([error]))
            } else return Failable.success(undefined)
        })
    }
}
