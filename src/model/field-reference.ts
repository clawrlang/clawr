import * as cir from '../cir'
import { Context, Expression } from '.'
import {
    AnyIsolationLevel,
    ISOLATED,
    IsolationLevel,
    SHARED,
} from './isolation-level'
import { _Failable, logSemanticError } from './failable'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration, DataField } from './data-declaration'
import { RCTypeLattice, Lattice } from './lattice'
import { VariableReference } from './variable-reference'
import { Failable, isFailure } from './gen-failable'

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
        if (this._isEffectivelyConst(context).value())
            logSemanticError(
                `Cannot mutate field ${this.field} of a reference type object`,
                { ...context, span: this.span },
            )

        if (
            this.object instanceof VariableReference ||
            this.object instanceof FieldReference
        ) {
            if (this.object._isolationLevel(context).value() === ISOLATED) {
                const object = this.object._toCIRExpression(context).value()
                return [{ kind: 'ENSURE_UNIQUE', object }]
            }
        }
        return []
    }

    *isEffectivelyConst(context: Context): Failable<boolean> {
        const isolationLevelResult = yield* this.object.isolationLevel(context)

        if ((yield isolationLevelResult) === SHARED)
            return Failable.success(false)

        return yield* this.object.isEffectivelyConst(context)
    }

    _isEffectivelyConst(context: Context): _Failable<boolean> {
        const result = Failable.do(() => this.isEffectivelyConst(context))
        return _Failable.of(result)
    }

    *isolationLevel(context: Context): Failable<IsolationLevel> {
        const field: DataField = yield yield* this.getFieldFromContext(context)
        return field.lattice instanceof RCTypeLattice
            ? Failable.success(field.isolationLevel ?? ISOLATED)
            : Failable.success(ISOLATED)
    }

    _isolationLevel(context: Context): _Failable<IsolationLevel> {
        const result = Failable.do(() => this.isolationLevel(context))
        return _Failable.of(result)
    }

    *declaredLattice(context: Context): Failable<Lattice> {
        const field = yield yield* this.getFieldFromContext(context)
        return Failable.success(field.lattice!)
    }

    _declaredLattice(context: Context): _Failable<Lattice> {
        const result = Failable.do(() => this.declaredLattice(context))
        return _Failable.of(result)
    }

    *currentValue(context: Context): Failable<Lattice> {
        const objectValue = yield yield* this.object.currentValue(context)
        if (!(objectValue instanceof RCTypeLattice))
            return Failable.failure('unknown object value', this.span)
        return objectValue.fields
            ? Failable.success(objectValue.fields[this.field])
            : Failable.failure(`unknown field value ${this.field}`, this.span)
    }

    _currentValue(context: Context): _Failable<Lattice> {
        const result = Failable.do(() => this.currentValue(context))
        return _Failable.of(result)
    }

    setCurrentValue(context: Context, value: Lattice) {
        const objectValue = this.object._currentValue(context).value()
        if (objectValue instanceof RCTypeLattice) {
            if (objectValue.fields) objectValue.fields[this.field] = value

            const object: Expression = this.object
            object.setCurrentValue?.(context, objectValue)
        }
    }

    *toCIRExpression(
        context: Context,
    ): Failable<cir.Expression & { kind: 'FIELD_REF' }> {
        yield yield* this.checkOperatorCompatibility(context)
        const fieldResult = yield* this.getFieldFromContext(context)
        if (isFailure(fieldResult)) return fieldResult
        const field: DataField = yield fieldResult
        const object: cir.Expression =
            yield yield* this.object.toCIRExpression(context)

        return Failable.success({
            kind: 'FIELD_REF',
            object,
            field: this.field,
            value: field.lattice.toCIR(),
        } satisfies cir.Expression)
    }

    _toCIRExpression(
        context: Context,
    ): _Failable<cir.Expression & { kind: 'FIELD_REF' }> {
        const result = Failable.do(() => this.toCIRExpression(context))
        return _Failable.of(result)
    }

    private *getFieldFromContext(
        context: Context,
    ): Failable<DataDeclaration['fields'][number]> {
        const objectValue = yield yield* this.object.declaredLattice(context)
        if (!(objectValue instanceof RCTypeLattice))
            return Failable.failure('unknown object value', this.span)
        const type = context.scope.dataDeclaration(objectValue.type)
        const field = type?.fields.find((field) => field.name === this.field)
        return field
            ? Failable.success(field)
            : Failable.failure(
                  `Field ${this.field} does not exist on type ${type?.name.canonical()}`,
                  this.fieldSpan,
              )
    }

    private *checkOperatorCompatibility(context: Context): Failable {
        const isolationLevel: AnyIsolationLevel =
            yield yield* this.object.isolationLevel(context)
        if ((isolationLevel === SHARED) !== (this.operator === '->')) {
            return Failable.failure(
                `Cannot access field ${this.field} of a ${isolationLevel} type object with "${this.operator}" operator`,
                this.span,
            )
        } else return Failable.success()
    }
}
