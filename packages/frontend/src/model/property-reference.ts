import { Context, Expression, isStorage } from '@/model'
import { DataDeclaration } from '@/model/data-declaration'
import { ISOLATED, IsolationLevel, SHARED } from '@/model/isolation-level'
import { RCTypeSet, ValueSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export class PropertyReference implements Expression {
    private constructor(
        public readonly object: Expression,
        private readonly operator: '.' | '->',
        public readonly property: string,
        public readonly span: SourceCodeSpan,
        private readonly propertySpan: SourceCodeSpan,
    ) {}

    static create({
        object,
        operator,
        property,
        span,
        propertySpan,
    }: {
        object: Expression
        operator: '.' | '->'
        property: string
        span: SourceCodeSpan
        propertySpan: SourceCodeSpan
    }): PropertyReference {
        return new PropertyReference(
            object,
            operator,
            property,
            span,
            propertySpan,
        )
    }

    assignmentPrelude(context: Context): SemanticResult<cir.Statement[]> {
        const constResult = this.isEffectivelyConst(context)
        if (constResult.isError) return constResult
        if (constResult.value)
            return SemanticErrorResult.failure(
                `Cannot mutate property ${this.property} of a reference type object`,
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
                return Result.value([{ kind: 'ENSURE_UNIQUE', object }])
        }
        return Result.value([])
    }

    isEffectivelyConst(context: Context): SemanticResult<boolean> {
        const isolationLevelResult = this.object.isolationLevel(context)

        if (isolationLevelResult.isError) return isolationLevelResult
        if (isolationLevelResult.value === SHARED) return Result.false

        return this.object.isEffectivelyConst(context)
    }

    isolationLevel(context: Context): SemanticResult<IsolationLevel> {
        const propertyResult = this.getPropertyFromContext(context)
        if (propertyResult.isError) return propertyResult
        const property = propertyResult.value
        return property.domain instanceof RCTypeSet
            ? Result.value(property.isolationLevel ?? ISOLATED)
            : Result.value(ISOLATED)
    }

    domain(context: Context): SemanticResult<ValueSet> {
        const propertyResult = this.getPropertyFromContext(context)
        if (propertyResult.isError) return propertyResult
        return Result.value(propertyResult.value.domain!)
    }

    currentValue(context: Context): SemanticResult<ValueSet> {
        const objectValueResult = this.object.currentValue(context)
        if (objectValueResult.isError) return objectValueResult
        const objectValue = objectValueResult.value
        if (!(objectValue instanceof RCTypeSet))
            return SemanticErrorResult.failure(
                `${objectValue.toCIR().type} is not an rc-type`,
                this.object.span,
            )
        if (objectValue.properties)
            return Result.value(objectValue.properties[this.property])

        return this.domain(context)
    }

    setCurrentValue(context: Context, value: ValueSet): SemanticResult {
        const objectvalueResult = this.object.currentValue(context)
        if (objectvalueResult.isError) return objectvalueResult
        const objectValue = objectvalueResult.value
        if (objectValue instanceof RCTypeSet) {
            if (objectValue.properties)
                objectValue.properties[this.property] = value

            const object: Expression = this.object
            const result = object.setCurrentValue?.(context, objectValue)
            if (result) return result
        }
        return Result.ok
    }

    toCIRExpression(
        context: Context,
    ): SemanticResult<cir.Expression & { kind: 'PROPERTY_REF' }> {
        const compatibilityResult = this.checkOperatorCompatibility(context)
        if (compatibilityResult.isError) return compatibilityResult
        const propertyResult = this.getPropertyFromContext(context)
        if (propertyResult.isError) return propertyResult
        const property = propertyResult.value
        const cirResult = this.object.toCIRExpression(context)
        if (cirResult.isError) return cirResult
        const object: cir.Expression = cirResult.value

        context.highlightRecorder?.record(
            'property',
            this.propertySpan,
            this.operator === '->' ? ['shared'] : [],
        )

        return Result.value({
            kind: 'PROPERTY_REF',
            object,
            property: this.property,
            value: property.domain.toCIR(),
        } satisfies cir.Expression)
    }

    private getPropertyFromContext(
        context: Context,
    ): SemanticResult<DataDeclaration['properties'][number]> {
        const objectValueResult = this.object.domain(context)
        if (objectValueResult.isError) return objectValueResult
        const objectValue = objectValueResult.value
        if (!(objectValue instanceof RCTypeSet))
            return SemanticErrorResult.failure(
                'unknown object value',
                this.span,
            )
        const type =
            context.scope.dataDeclaration(objectValue.type) ||
            context.scope.objectDeclaration(objectValue.type)
        const property = type?.properties.find(
            (property) => property.name === this.property,
        )
        return property
            ? Result.value(property)
            : SemanticErrorResult.failure(
                  `Property ${this.property} does not exist on type ${type?.name.canonical()}`,
                  this.propertySpan,
              )
    }

    private checkOperatorCompatibility(context: Context): SemanticResult {
        const isolationLevelResult = this.object.isolationLevel(context)
        if (isolationLevelResult.isError) return isolationLevelResult
        const isolationLevel = isolationLevelResult.value
        if ((isolationLevel === SHARED) !== (this.operator === '->')) {
            return SemanticErrorResult.failure(
                `Cannot access property ${this.property} of a ${isolationLevel} type object with "${this.operator}" operator`,
                this.span,
            )
        } else return Result.ok
    }
}
