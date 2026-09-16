import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, isFailure, Result } from '@/tools/failable'
import { Context, Expression, isStorage } from '.'
import { DataDeclaration, DataField } from './data-declaration'
import {
    AnyIsolationLevel,
    ISOLATED,
    IsolationLevel,
    SHARED,
} from './isolation-level'
import { Lattice, RCTypeLattice } from './lattice'

export class FieldReference implements Expression {
    private constructor(
        public readonly object: Expression,
        private readonly operator: '.' | '->',
        public readonly field: string,
        public readonly span: SourceCodeSpan,
        private readonly fieldSpan: SourceCodeSpan,
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
        if (yield yield* this.isEffectivelyConst_obsolete(context))
            yield Result.failure(
                `Cannot mutate field ${this.field} of a reference type object`,
                this.span,
            )

        if (isStorage(this.object)) {
            const isolationLevel =
                yield yield* this.object.isolationLevel_obsolete(context)
            if (isolationLevel === ISOLATED) {
                const object: cir.Expression & {
                    kind: 'VARABLE_REF' | 'FIELD_REF'
                } = yield yield* this.object.toCIRExpression_obsolete(context)
                return Result.value([{ kind: 'ENSURE_UNIQUE', object }])
            }
        }
        return Result.value([])
    }

    *isEffectivelyConst_obsolete(context: Context): Failable<boolean> {
        const isolationLevelResult =
            yield* this.object.isolationLevel_obsolete(context)

        if ((yield isolationLevelResult) === SHARED) return Result.false

        return yield* this.object.isEffectivelyConst_obsolete(context)
    }

    *isolationLevel_obsolete(context: Context): Failable<IsolationLevel> {
        const field: DataField = yield yield* this.getFieldFromContext(context)
        return field.lattice instanceof RCTypeLattice
            ? Result.value(field.isolationLevel ?? ISOLATED)
            : Result.value(ISOLATED)
    }

    *declaredLattice_obsolete(context: Context): Failable<Lattice> {
        const field = yield yield* this.getFieldFromContext(context)
        return Result.value(field.lattice!)
    }

    *currentValue_obsolete(context: Context): Failable<Lattice> {
        const objectValue =
            yield yield* this.object.currentValue_obsolete(context)
        if (!(objectValue instanceof RCTypeLattice))
            return Result.failure('unknown object value', this.span)
        return objectValue.fields
            ? Result.value(objectValue.fields[this.field])
            : Result.failure(`unknown field value ${this.field}`, this.span)
    }

    *setCurrentValue_obsolete(context: Context, value: Lattice): Failable {
        const objectValue =
            yield yield* this.object.currentValue_obsolete(context)
        if (objectValue instanceof RCTypeLattice) {
            if (objectValue.fields) objectValue.fields[this.field] = value

            const object: Expression = this.object
            const result = object.setCurrentValue_obsolete?.(
                context,
                objectValue,
            )
            if (result) return yield* result
        }
        return Result.success
    }

    *toCIRExpression_obsolete(
        context: Context,
    ): Failable<cir.Expression & { kind: 'FIELD_REF' }> {
        yield yield* this.checkOperatorCompatibility(context)
        const fieldResult = yield* this.getFieldFromContext(context)
        if (isFailure(fieldResult)) return fieldResult
        const field: DataField = yield fieldResult
        const object: cir.Expression =
            yield yield* this.object.toCIRExpression_obsolete(context)

        return Result.value({
            kind: 'FIELD_REF',
            object,
            field: this.field,
            value: field.lattice.toCIR(),
        } satisfies cir.Expression)
    }

    private *getFieldFromContext(
        context: Context,
    ): Failable<DataDeclaration['fields'][number]> {
        const objectValue =
            yield yield* this.object.declaredLattice_obsolete(context)
        if (!(objectValue instanceof RCTypeLattice))
            return Result.failure('unknown object value', this.span)
        const type = context.scope.dataDeclaration(objectValue.type)
        const field = type?.fields.find((field) => field.name === this.field)
        return field
            ? Result.value(field)
            : Result.failure(
                  `Field ${this.field} does not exist on type ${type?.name.canonical()}`,
                  this.fieldSpan,
              )
    }

    private *checkOperatorCompatibility(context: Context): Failable {
        const isolationLevel: AnyIsolationLevel =
            yield yield* this.object.isolationLevel_obsolete(context)
        if ((isolationLevel === SHARED) !== (this.operator === '->')) {
            return Result.failure(
                `Cannot access field ${this.field} of a ${isolationLevel} type object with "${this.operator}" operator`,
                this.span,
            )
        } else return Result.success
    }
}
