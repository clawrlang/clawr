import { Context, ContextWithDomain, Expression } from '@/model'
import { FunctionCall } from '@/model/function-call'
import { UNIQUE } from '@/model/isolation-level'
import { TypeName } from '@/model/type-name'
import { RCTypeSet, ValueSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result, SuccessResult } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export class DataLiteral implements Expression {
    private constructor(
        readonly initializerCall: FunctionCall | undefined,
        private readonly properties: PropertyValue[],
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        initializerCall,
        properties,
        span,
    }: {
        initializerCall?: FunctionCall
        properties: PropertyValue[]
        span: SourceCodeSpan
    }): DataLiteral {
        return new DataLiteral(initializerCall, properties, span)
    }

    isEffectivelyConst(): SuccessResult<true> {
        return Result.true
    }

    isolationLevel(): SuccessResult<UNIQUE> {
        return Result.value(UNIQUE)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        const explicitDomain = context.explicitDomain
        if (!(explicitDomain instanceof RCTypeSet))
            return SemanticErrorResult.failure(
                'Data Literal without explicit value set is not supported',
                this.span,
            )
        const dataDecl = context.scope.dataDeclaration(explicitDomain.type)
        const objectDecl = context.scope.objectDeclaration(explicitDomain.type)
        const decl = dataDecl ?? objectDecl
        if (!decl)
            return SemanticErrorResult.failure(
                `DataLiteral.currentValue: type ${explicitDomain.type.name} not found in scope`,
                this.span,
            )

        const propertyValuesResult = SemanticResult.collect(
            this.properties.map((property) => {
                const propertyDeclaration = decl.properties.find(
                    (declaredProperty) =>
                        declaredProperty.name === property.name,
                )
                if (!propertyDeclaration)
                    return SemanticErrorResult.failure(
                        `DataLiteral.currentValue: property ${property.name} not found on type ${explicitDomain.type.name}`,
                        this.span,
                    )
                return property.value.currentValue({
                    ...context,
                    explicitDomain: propertyDeclaration.domain,
                })
            }),
        )
        if (propertyValuesResult.isError) return propertyValuesResult
        const propertyValues = propertyValuesResult.value
        return Result.value(
            RCTypeSet.create({
                type: decl.name,
                properties: Object.fromEntries(
                    propertyValues.map((value, index) => [
                        this.properties[index].name,
                        value,
                    ]),
                ),
            }),
        )
    }

    domain(context: Context & { type: TypeName }): SemanticResult<ValueSet> {
        const decl = context.scope.dataDeclaration(context.type)
        if (!decl)
            return SemanticErrorResult.failure(
                `DataLiteral.domain: type ${context.type.name} not found in scope`,
                this.span,
            )
        return Result.value(
            RCTypeSet.create({
                type: decl.name,
                properties: Object.fromEntries(
                    decl.properties.map((property) => [
                        property.name,
                        property.domain,
                    ]),
                ),
            }),
        )
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression & { kind: 'ALLOCATION' }> {
        const explicitDomain = context.explicitDomain
        if (!(explicitDomain instanceof RCTypeSet))
            return SemanticErrorResult.failure(
                'DataLiteral.toCIRExpression: data literal without explicit type',
                this.span,
            )
        if (!context.isolationLevel)
            return SemanticErrorResult.failure(
                'DataLiteral.toCIRExpression: target isolation level not specified',
                this.span,
            )

        const targetType =
            context.scope.dataDeclaration(explicitDomain.type) ??
            context.scope.objectDeclaration(explicitDomain.type)
        if (!targetType)
            return SemanticErrorResult.failure(
                `DataLiteral.toCIRExpression: target type ${explicitDomain.type.name} not found in scope`,
                this.span,
            )
        const propertyDeclarations = new Map(
            targetType.properties.map((property) => [property.name, property]),
        )

        const propertyValuesResult = SemanticResult.collect(
            this.properties.map((property) => {
                const propertyDeclaration = propertyDeclarations.get(
                    property.name,
                )
                if (!propertyDeclaration)
                    return SemanticErrorResult.failure(
                        `Property ${property.name} not found on type ${explicitDomain.type.canonical()}`,
                        this.span,
                    )
                const nestedContext: ContextWithDomain = {
                    ...context,
                    explicitDomain: propertyDeclaration.domain,
                    isolationLevel: propertyDeclaration.isolationLevel,
                }
                const valueResult =
                    property.value.toCIRExpression(nestedContext)
                if (valueResult.isError) return valueResult
                return Result.value({
                    name: property.name,
                    value: valueResult.value,
                    domain: valueResult.value.domain,
                })
            }),
        )
        if (propertyValuesResult.isError) return propertyValuesResult

        const properties = propertyValuesResult.value
        return Result.value({
            kind: 'ALLOCATION',
            isolationLevel: context.isolationLevel!,
            properties,
            domain: {
                type: 'rc-type',
                ...explicitDomain.type.toCIR(),
            },
        } satisfies cir.Expression)
    }
}

type PropertyValue = {
    name: string
    value: Expression
}
