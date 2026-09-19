import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { isFailure, SemanticResult } from '@/tools/semantic-result'
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
        if (isFailure(constResult)) return constResult
        if (constResult.value)
            return SemanticResult.failure(
                `Cannot mutate field ${this.field} of a reference type object`,
                this.span,
            )

        if (isStorage(this.object)) {
            const collected = SemanticResult.collect([
                this.object.isolationLevel(context),
                this.object.toCIRExpression(context),
            ])
            if (isFailure(collected)) return collected
            const [isolationLevel, object] = collected.value
            if (isolationLevel === ISOLATED)
                return SemanticResult.value([{ kind: 'ENSURE_UNIQUE', object }])
        }
        return SemanticResult.value([])
    }

    isEffectivelyConst(context: Context): SemanticResult<boolean> {
        const isolationLevelResult = this.object.isolationLevel(context)

        if (isFailure(isolationLevelResult)) return isolationLevelResult
        if (isolationLevelResult.value === SHARED) return SemanticResult.false

        return this.object.isEffectivelyConst(context)
    }

    isolationLevel(context: Context): SemanticResult<IsolationLevel> {
        const fieldResult = this.getFieldFromContext(context)
        if (isFailure(fieldResult)) return fieldResult
        const field = fieldResult.value
        return field.lattice instanceof RCTypeLattice
            ? SemanticResult.value(field.isolationLevel ?? ISOLATED)
            : SemanticResult.value(ISOLATED)
    }

    declaredLattice(context: Context): SemanticResult<Lattice> {
        const fieldResult = this.getFieldFromContext(context)
        if (isFailure(fieldResult)) return fieldResult
        return SemanticResult.value(fieldResult.value.lattice!)
    }

    currentValue(context: Context): SemanticResult<Lattice> {
        const objectValueResult = this.object.currentValue(context)
        if (isFailure(objectValueResult)) return objectValueResult
        const objectValue = objectValueResult.value
        if (!(objectValue instanceof RCTypeLattice))
            return SemanticResult.failure(
                `${objectValue.toCIR().type} is not an rc-type`,
                this.object.span,
            )
        if (objectValue.fields)
            return SemanticResult.value(objectValue.fields[this.field])

        return this.declaredLattice(context)
    }

    setCurrentValue(context: Context, value: Lattice): SemanticResult {
        const objectvalueResult = this.object.currentValue(context)
        if (isFailure(objectvalueResult)) return objectvalueResult
        const objectValue = objectvalueResult.value
        if (objectValue instanceof RCTypeLattice) {
            if (objectValue.fields) objectValue.fields[this.field] = value

            const object: Expression = this.object
            const result = object.setCurrentValue?.(context, objectValue)
            if (result) return result
        }
        return SemanticResult.success
    }

    toCIRExpression(
        context: Context,
    ): SemanticResult<cir.Expression & { kind: 'FIELD_REF' }> {
        const compatibilityResult = this.checkOperatorCompatibility(context)
        if (isFailure(compatibilityResult)) return compatibilityResult
        const fieldResult = this.getFieldFromContext(context)
        if (isFailure(fieldResult)) return fieldResult
        const field = fieldResult.value
        const cirResult = this.object.toCIRExpression(context)
        if (isFailure(cirResult)) return cirResult
        const object: cir.Expression = cirResult.value

        return SemanticResult.value({
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
        if (isFailure(objectValueResult)) return objectValueResult
        const objectValue = objectValueResult.value
        if (!(objectValue instanceof RCTypeLattice))
            return SemanticResult.failure('unknown object value', this.span)
        const type =
            context.scope.dataDeclaration(objectValue.type) ||
            context.scope.objectDeclaration(objectValue.type)
        const field = type?.fields.find((field) => field.name === this.field)
        return field
            ? SemanticResult.value(field)
            : SemanticResult.failure(
                  `Field ${this.field} does not exist on type ${type?.name.canonical()}`,
                  this.fieldSpan,
              )
    }

    private checkOperatorCompatibility(context: Context): SemanticResult {
        const isolationLevelResult = this.object.isolationLevel(context)
        if (isFailure(isolationLevelResult)) return isolationLevelResult
        const isolationLevel = isolationLevelResult.value
        if ((isolationLevel === SHARED) !== (this.operator === '->')) {
            return SemanticResult.failure(
                `Cannot access field ${this.field} of a ${isolationLevel} type object with "${this.operator}" operator`,
                this.span,
            )
        } else return SemanticResult.success
    }
}
