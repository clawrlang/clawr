import * as cir from '@/cir'
import { Context, Expression, isStorage } from '.'
import {
    AnyIsolationLevel,
    ISOLATED,
    IsolationLevel,
    SHARED,
} from './isolation-level'
import { SourceCodeSpan } from '@/diagnostics'
import { DataDeclaration, DataField } from './data-declaration'
import { RCTypeLattice, Lattice } from './lattice'
import { Failable, isFailure } from '@/model/failable'

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

    *assignmentPrelude(context: Context): Failable<cir.Statement[]> {
        if (yield yield* this.isEffectivelyConst(context))
            yield Failable.failure(
                `Cannot mutate field ${this.field} of a reference type object`,
                this.span,
            )

        if (isStorage(this.object)) {
            const isolationLevel =
                yield yield* this.object.isolationLevel(context)
            if (isolationLevel === ISOLATED) {
                const object: cir.Expression & {
                    kind: 'VARABLE_REF' | 'FIELD_REF'
                } = yield yield* this.object.toCIRExpression(context)
                return Failable.success([{ kind: 'ENSURE_UNIQUE', object }])
            }
        }
        return Failable.success([])
    }

    *isEffectivelyConst(context: Context): Failable<boolean> {
        const isolationLevelResult = yield* this.object.isolationLevel(context)

        if ((yield isolationLevelResult) === SHARED)
            return Failable.success(false)

        return yield* this.object.isEffectivelyConst(context)
    }

    *isolationLevel(context: Context): Failable<IsolationLevel> {
        const field: DataField = yield yield* this.getFieldFromContext(context)
        return field.lattice instanceof RCTypeLattice
            ? Failable.success(field.isolationLevel ?? ISOLATED)
            : Failable.success(ISOLATED)
    }

    *declaredLattice(context: Context): Failable<Lattice> {
        const field = yield yield* this.getFieldFromContext(context)
        return Failable.success(field.lattice!)
    }

    *currentValue(context: Context): Failable<Lattice> {
        const objectValue = yield yield* this.object.currentValue(context)
        if (!(objectValue instanceof RCTypeLattice))
            return Failable.failure('unknown object value', this.span)
        return objectValue.fields
            ? Failable.success(objectValue.fields[this.field])
            : Failable.failure(`unknown field value ${this.field}`, this.span)
    }

    *setCurrentValue(context: Context, value: Lattice): Failable {
        const objectValue = yield yield* this.object.currentValue(context)
        if (objectValue instanceof RCTypeLattice) {
            if (objectValue.fields) objectValue.fields[this.field] = value

            const object: Expression = this.object
            const result = object.setCurrentValue?.(context, objectValue)
            if (result) return yield* result
        }
        return Failable.success()
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
