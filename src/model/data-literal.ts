import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result, SuccessResult } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import { Context, ContextWithDomain, Expression } from '.'
import { FunctionCall } from './function-call'
import { UNIQUE } from './isolation-level'
import { TypeName } from './type-name'
import { RCTypeSet, ValueSet } from './value-set'

export class DataLiteral implements Expression {
    private constructor(
        readonly initializerCall: FunctionCall | undefined,
        private readonly fields: FieldValue[],
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        initializerCall,
        fields,
        span,
    }: {
        initializerCall?: FunctionCall
        fields: FieldValue[]
        span: SourceCodeSpan
    }): DataLiteral {
        return new DataLiteral(initializerCall, fields, span)
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

        const fieldValuesResult = SemanticResult.collect(
            this.fields.map((field) => {
                const fieldDeclaration = decl.fields.find(
                    (declaredField) => declaredField.name === field.name,
                )
                if (!fieldDeclaration)
                    return SemanticErrorResult.failure(
                        `DataLiteral.currentValue: field ${field.name} not found on type ${explicitDomain.type.name}`,
                        this.span,
                    )
                return field.value.currentValue({
                    ...context,
                    explicitDomain: fieldDeclaration.domain,
                })
            }),
        )
        if (fieldValuesResult.isError) return fieldValuesResult
        const fieldValues = fieldValuesResult.value
        return Result.value(
            RCTypeSet.create({
                type: decl.name,
                fields: Object.fromEntries(
                    fieldValues.map((value, index) => [
                        this.fields[index].name,
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
                fields: Object.fromEntries(
                    decl.fields.map((field) => [field.name, field.domain]),
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
        const fieldDeclarations = new Map(
            targetType.fields.map((field) => [field.name, field]),
        )

        const fieldValuesResult = SemanticResult.collect(
            this.fields.map((field) => {
                const fieldDeclaration = fieldDeclarations.get(field.name)
                if (!fieldDeclaration)
                    return SemanticErrorResult.failure(
                        `field ${field.name} not found on type ${explicitDomain.type.canonical()}`,
                        this.span,
                    )
                const nestedContext: ContextWithDomain = {
                    ...context,
                    explicitDomain: fieldDeclaration.domain,
                    isolationLevel: fieldDeclaration.isolationLevel,
                }
                const valueResult = field.value.toCIRExpression(nestedContext)
                if (valueResult.isError) return valueResult
                return Result.value({
                    name: field.name,
                    value: valueResult.value,
                    domain: valueResult.value.value,
                })
            }),
        )
        if (fieldValuesResult.isError) return fieldValuesResult

        const fields = fieldValuesResult.value
        return Result.value({
            kind: 'ALLOCATION',
            isolationLevel: context.isolationLevel!,
            fields,
            value: {
                type: 'rc-type',
                ...explicitDomain.type.toCIR(),
            },
        } satisfies cir.Expression)
    }
}

type FieldValue = {
    name: string
    value: Expression
}
