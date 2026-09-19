import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result, SuccessResult } from '@/tools/result'
import { ErrorResult, SemanticResult } from '@/tools/semantic-result'
import { Context, ContextWithLattice, Expression } from '.'
import { FunctionCall } from './function-call'
import { UNIQUE } from './isolation-level'
import { Lattice, RCTypeLattice } from './lattice'
import { TypeName } from './type-name'

export class DataLiteral implements Expression {
    private constructor(
        private readonly initializerCall: FunctionCall | undefined,
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

    currentValue(context: ContextWithLattice): SemanticResult<Lattice> {
        const explicitLattice = context.explicitLattice
        if (!(explicitLattice instanceof RCTypeLattice))
            return ErrorResult.failure(
                'Data Literal without explicit value set is not supported',
                this.span,
            )
        const dataDecl = context.scope.dataDeclaration(explicitLattice.type)
        const objectDecl = context.scope.objectDeclaration(explicitLattice.type)
        const decl = dataDecl ?? objectDecl
        if (!decl)
            return ErrorResult.failure(
                `DataLiteral.currentValue: type ${explicitLattice.type.name} not found in scope`,
                this.span,
            )

        const fieldValuesResult = SemanticResult.collect(
            this.fields.map((field) => {
                const fieldDeclaration = decl.fields.find(
                    (declaredField) => declaredField.name === field.name,
                )
                if (!fieldDeclaration)
                    return ErrorResult.failure(
                        `DataLiteral.currentValue: field ${field.name} not found on type ${explicitLattice.type.name}`,
                        this.span,
                    )
                return field.value.currentValue({
                    ...context,
                    explicitLattice: fieldDeclaration.lattice,
                })
            }),
        )
        if (fieldValuesResult.isError) return fieldValuesResult
        const fieldValues = fieldValuesResult.value
        return Result.value(
            RCTypeLattice.create({
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

    declaredLattice(
        context: Context & { type: TypeName },
    ): SemanticResult<Lattice> {
        const decl = context.scope.dataDeclaration(context.type)
        if (!decl)
            return ErrorResult.failure(
                `DataLiteral.declaredLattice: type ${context.type.name} not found in scope`,
                this.span,
            )
        return Result.value(
            RCTypeLattice.create({
                type: decl.name,
                fields: Object.fromEntries(
                    decl.fields.map((field) => [field.name, field.lattice]),
                ),
            }),
        )
    }

    toCIRExpression(
        context: ContextWithLattice,
    ): SemanticResult<cir.Expression> {
        const explicitLattice = context.explicitLattice
        if (!(explicitLattice instanceof RCTypeLattice))
            return ErrorResult.failure(
                'DataLiteral.toCIRExpression: data literal without explicit type',
                this.span,
            )
        if (!context.isolationLevel)
            return ErrorResult.failure(
                'DataLiteral.toCIRExpression: target isolation level not specified',
                this.span,
            )

        const targetType =
            context.scope.dataDeclaration(explicitLattice.type) ??
            context.scope.objectDeclaration(explicitLattice.type)
        if (!targetType)
            return ErrorResult.failure(
                `DataLiteral.toCIRExpression: target type ${explicitLattice.type.name} not found in scope`,
                this.span,
            )
        const fieldDeclarations = new Map(
            targetType.fields.map((field) => [field.name, field]),
        )

        const fieldValuesResult = SemanticResult.collect(
            this.fields.map((field) => {
                const fieldDeclaration = fieldDeclarations.get(field.name)
                if (!fieldDeclaration)
                    return ErrorResult.failure(
                        `field ${field.name} not found on type ${explicitLattice.type.canonical()}`,
                        this.span,
                    )
                const nestedContext: ContextWithLattice = {
                    ...context,
                    explicitLattice: fieldDeclaration.lattice,
                    isolationLevel: fieldDeclaration.isolationLevel,
                }
                const valueResult = field.value.toCIRExpression(nestedContext)
                if (valueResult.isError) return valueResult
                return Result.value({
                    name: field.name,
                    value: valueResult.value,
                    lattice: valueResult.value.value,
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
                ...explicitLattice.type.toCIR(),
            },
        } satisfies cir.Expression)
    }
}

type FieldValue = {
    name: string
    value: Expression
}
