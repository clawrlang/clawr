import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { isFailure, Result } from '@/tools/failable'
import { Context, Expression, isStorage } from '.'
import { DataDeclaration } from './data-declaration'
import { ISOLATED, IsolationLevel, SHARED } from './isolation-level'
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

    assignmentPrelude(context: Context): Result<cir.Statement[]> {
        const constResult = this.isEffectivelyConst(context)
        if (isFailure(constResult)) return constResult
        if (constResult.value)
            return Result.failure(
                `Cannot mutate field ${this.field} of a reference type object`,
                this.span,
            )

        if (isStorage(this.object)) {
            const collected = Result.collect([
                this.object.isolationLevel(context),
                this.object.toCIRExpression(context),
            ])
            if (isFailure(collected)) return collected
            const [isolationLevel, object] = collected.value
            if (isolationLevel === ISOLATED)
                return Result.value([{ kind: 'ENSURE_UNIQUE', object }])
        }
        return Result.value([])
    }

    isEffectivelyConst(context: Context): Result<boolean> {
        const isolationLevelResult = this.object.isolationLevel(context)

        if (isFailure(isolationLevelResult)) return isolationLevelResult
        if (isolationLevelResult.value === SHARED) return Result.false

        return this.object.isEffectivelyConst(context)
    }

    isolationLevel(context: Context): Result<IsolationLevel> {
        const fieldResult = this.getFieldFromContext(context)
        if (isFailure(fieldResult)) return fieldResult
        const field = fieldResult.value
        return field.lattice instanceof RCTypeLattice
            ? Result.value(field.isolationLevel ?? ISOLATED)
            : Result.value(ISOLATED)
    }

    declaredLattice(context: Context): Result<Lattice> {
        const fieldResult = this.getFieldFromContext(context)
        if (isFailure(fieldResult)) return fieldResult
        return Result.value(fieldResult.value.lattice!)
    }

    currentValue(context: Context): Result<Lattice> {
        const objectValueResult = this.object.currentValue(context)
        if (isFailure(objectValueResult)) return objectValueResult
        const objectValue = objectValueResult.value
        if (!(objectValue instanceof RCTypeLattice))
            return Result.failure('unknown object value', this.span)
        return objectValue.fields
            ? Result.value(objectValue.fields[this.field])
            : Result.failure(`unknown field value ${this.field}`, this.span)
    }

    setCurrentValue(context: Context, value: Lattice): Result {
        const objectvalueResult = this.object.currentValue(context)
        if (isFailure(objectvalueResult)) return objectvalueResult
        const objectValue = objectvalueResult.value
        if (objectValue instanceof RCTypeLattice) {
            if (objectValue.fields) objectValue.fields[this.field] = value

            const object: Expression = this.object
            const result = object.setCurrentValue?.(context, objectValue)
            if (result) return result
        }
        return Result.success
    }

    toCIRExpression(
        context: Context,
    ): Result<cir.Expression & { kind: 'FIELD_REF' }> {
        const compatibilityResult = this.checkOperatorCompatibility(context)
        if (isFailure(compatibilityResult)) return compatibilityResult
        const fieldResult = this.getFieldFromContext(context)
        if (isFailure(fieldResult)) return fieldResult
        const field = fieldResult.value
        const cirResult = this.object.toCIRExpression(context)
        if (isFailure(cirResult)) return cirResult
        const object: cir.Expression = cirResult.value

        return Result.value({
            kind: 'FIELD_REF',
            object,
            field: this.field,
            value: field.lattice.toCIR(),
        } satisfies cir.Expression)
    }

    private getFieldFromContext(
        context: Context,
    ): Result<DataDeclaration['fields'][number]> {
        const objectValueResult = this.object.declaredLattice(context)
        if (isFailure(objectValueResult)) return objectValueResult
        const objectValue = objectValueResult.value
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

    private checkOperatorCompatibility(context: Context): Result {
        const isolationLevelResult = this.object.isolationLevel(context)
        if (isFailure(isolationLevelResult)) return isolationLevelResult
        const isolationLevel = isolationLevelResult.value
        if ((isolationLevel === SHARED) !== (this.operator === '->')) {
            return Result.failure(
                `Cannot access field ${this.field} of a ${isolationLevel} type object with "${this.operator}" operator`,
                this.span,
            )
        } else return Result.success
    }
}
