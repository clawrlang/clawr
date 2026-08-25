import * as cir from '../cir'
import { Context, Expression } from '.'
import { ISOLATED, IsolationLevel, SHARED } from './isolation-level'
import { _Failable, logSemanticError } from './failable'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration } from './data-declaration'
import { RCTypeLattice, Lattice } from './lattice'
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
            if (this.object.isolationLevel(context).value() === ISOLATED) {
                const object = this.object.toCIRExpression(context).value()
                return [{ kind: 'ENSURE_UNIQUE', object }]
            }
        }
        return []
    }

    isEffectivelyConst(context: Context): _Failable<boolean> {
        return this.object
            .isolationLevel(context)
            .chaining((isolationLevel) =>
                isolationLevel === SHARED
                    ? _Failable.success(false)
                    : this.object.isEffectivelyConst(context),
            )
    }

    isolationLevel(context: Context): _Failable<IsolationLevel> {
        const field = this.getFieldFromContext(context).value()
        return field.lattice instanceof RCTypeLattice
            ? _Failable.success(field.isolationLevel ?? ISOLATED)
            : _Failable.success(ISOLATED)
    }

    declaredLattice(context: Context): _Failable<Lattice> {
        return this.getFieldFromContext(context).chaining((field) =>
            _Failable.success(field.lattice!),
        )
    }

    currentValue(context: Context): _Failable<Lattice> {
        const objectValue = this.object.currentValue(context).value()
        if (!(objectValue instanceof RCTypeLattice))
            return _Failable.failure('unknown object value', this.span)
        return objectValue.fields
            ? _Failable.success(objectValue.fields[this.field])
            : _Failable.failure(`unknown field value ${this.field}`, this.span)
    }

    setCurrentValue(context: Context, value: Lattice) {
        const objectValue = this.object.currentValue(context).value()
        if (objectValue instanceof RCTypeLattice) {
            if (objectValue.fields) objectValue.fields[this.field] = value

            const object: Expression = this.object
            object.setCurrentValue?.(context, objectValue)
        }
    }

    toCIRExpression(
        context: Context,
    ): _Failable<cir.Expression & { kind: 'FIELD_REF' }> {
        return _Failable
            .collect([
                this.checkOperatorCompatibility(context),
                this.getFieldFromContext(context),
                this.object.toCIRExpression(context),
            ])
            .chaining(([, field, object]) =>
                _Failable.success({
                    kind: 'FIELD_REF',
                    object,
                    field: this.field,
                    value: field.lattice.toCIR(),
                } satisfies cir.Expression),
            )
    }

    private getFieldFromContext(
        context: Context,
    ): _Failable<DataDeclaration['fields'][number]> {
        const objectValue = this.object.declaredLattice(context).value()
        if (!(objectValue instanceof RCTypeLattice))
            return _Failable.failure('unknown object value', this.span)
        const type = context.scope.dataDeclaration(objectValue.type)
        const field = type?.fields.find((field) => field.name === this.field)
        return field
            ? _Failable.success(field)
            : _Failable.failure(
                  `Field ${this.field} does not exist on type ${type?.name.canonical()}`,
                  this.fieldSpan,
              )
    }

    private checkOperatorCompatibility(context: Context): _Failable {
        return this.object
            .isolationLevel(context)
            .chaining((isolationLevel) => {
                if ((isolationLevel === SHARED) !== (this.operator === '->')) {
                    return _Failable.failure(
                        `Cannot access field ${this.field} of a ${isolationLevel} type object with "${this.operator}" operator`,
                        this.span,
                    )
                } else return _Failable.success(undefined)
            })
    }
}
