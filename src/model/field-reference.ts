import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { SuccessResult } from '@/tools/result'
import { ErrorResult, SemanticResult } from '@/tools/semantic-result'
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

    assignmentPrelude(context: Context): SemanticResult<cir.Statement[]> {
        const constResult = this.isEffectivelyConst(context)
        if (constResult.isError) return constResult
        if (constResult.value)
            return ErrorResult.failure(
                `Cannot mutate field ${this.field} of a reference type object`,
                this.span,
            )

        if (isStorage(this.object)) {
            const collected = SemanticResult.collect([
                this.object.isolationLevel(context),
                this.object.toCIRExpression(context),
            ])
            if (collected.isError) return collected
            const [isolationLevel, object] = collected.value
            if (isolationLevel === ISOLATED)
                return SuccessResult.value([{ kind: 'ENSURE_UNIQUE', object }])
        }
        return SuccessResult.value([])
    }

    isEffectivelyConst(context: Context): SemanticResult<boolean> {
        const isolationLevelResult = this.object.isolationLevel(context)

        if (isolationLevelResult.isError) return isolationLevelResult
        if (isolationLevelResult.value === SHARED) return SuccessResult.false

        return this.object.isEffectivelyConst(context)
    }

    isolationLevel(context: Context): SemanticResult<IsolationLevel> {
        const fieldResult = this.getFieldFromContext(context)
        if (fieldResult.isError) return fieldResult
        const field = fieldResult.value
        return field.lattice instanceof RCTypeLattice
            ? SuccessResult.value(field.isolationLevel ?? ISOLATED)
            : SuccessResult.value(ISOLATED)
    }

    declaredLattice(context: Context): SemanticResult<Lattice> {
        const fieldResult = this.getFieldFromContext(context)
        if (fieldResult.isError) return fieldResult
        return SuccessResult.value(fieldResult.value.lattice!)
    }

    currentValue(context: Context): SemanticResult<Lattice> {
        const objectValueResult = this.object.currentValue(context)
        if (objectValueResult.isError) return objectValueResult
        const objectValue = objectValueResult.value
        if (!(objectValue instanceof RCTypeLattice))
            return ErrorResult.failure(
                `${objectValue.toCIR().type} is not an rc-type`,
                this.object.span,
            )
        if (objectValue.fields)
            return SuccessResult.value(objectValue.fields[this.field])

        return this.declaredLattice(context)
    }

    setCurrentValue(context: Context, value: Lattice): SemanticResult {
        const objectvalueResult = this.object.currentValue(context)
        if (objectvalueResult.isError) return objectvalueResult
        const objectValue = objectvalueResult.value
        if (objectValue instanceof RCTypeLattice) {
            if (objectValue.fields) objectValue.fields[this.field] = value

            const object: Expression = this.object
            const result = object.setCurrentValue?.(context, objectValue)
            if (result) return result
        }
        return SuccessResult.ok
    }

    toCIRExpression(
        context: Context,
    ): SemanticResult<cir.Expression & { kind: 'FIELD_REF' }> {
        const compatibilityResult = this.checkOperatorCompatibility(context)
        if (compatibilityResult.isError) return compatibilityResult
        const fieldResult = this.getFieldFromContext(context)
        if (fieldResult.isError) return fieldResult
        const field = fieldResult.value
        const cirResult = this.object.toCIRExpression(context)
        if (cirResult.isError) return cirResult
        const object: cir.Expression = cirResult.value

        return SuccessResult.value({
            kind: 'FIELD_REF',
            object,
            field: this.field,
            value: field.lattice.toCIR(),
        } satisfies cir.Expression)
    }

    private getFieldFromContext(
        context: Context,
    ): SemanticResult<DataDeclaration['fields'][number]> {
        const objectValueResult = this.object.declaredLattice(context)
        if (objectValueResult.isError) return objectValueResult
        const objectValue = objectValueResult.value
        if (!(objectValue instanceof RCTypeLattice))
            return ErrorResult.failure('unknown object value', this.span)
        const type =
            context.scope.dataDeclaration(objectValue.type) ||
            context.scope.objectDeclaration(objectValue.type)
        const field = type?.fields.find((field) => field.name === this.field)
        return field
            ? SuccessResult.value(field)
            : ErrorResult.failure(
                  `Field ${this.field} does not exist on type ${type?.name.canonical()}`,
                  this.fieldSpan,
              )
    }

    private checkOperatorCompatibility(context: Context): SemanticResult {
        const isolationLevelResult = this.object.isolationLevel(context)
        if (isolationLevelResult.isError) return isolationLevelResult
        const isolationLevel = isolationLevelResult.value
        if ((isolationLevel === SHARED) !== (this.operator === '->')) {
            return ErrorResult.failure(
                `Cannot access field ${this.field} of a ${isolationLevel} type object with "${this.operator}" operator`,
                this.span,
            )
        } else return SuccessResult.ok
    }
}
