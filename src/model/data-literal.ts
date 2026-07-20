import * as cir from '../cir'
import { Context, Expression, logSemanticError } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration } from './data-declaration'
import { Lattice, UniqueTypeLattice } from './lattice'

export class DataLiteral implements Expression {
    private constructor(
        private fields: FieldValue[],
        public span: SourceCodeSpan,
    ) {}

    static create({
        fields,
        span,
    }: {
        fields: FieldValue[]
        span: SourceCodeSpan
    }): DataLiteral {
        return new DataLiteral(fields, span)
    }

    isEffectivelyConst(_: Context): boolean {
        return true
    }

    currentValue(context: Context & { typeName: string }): Lattice {
        const typeDeclaration = context.scope.dataDeclaration(context.typeName)
        if (!typeDeclaration)
            logSemanticError(
                `DataLiteral.currentValue: type ${context.typeName} not found in scope`,
                { ...context, span: this.span, fatal: true },
            )
        return UniqueTypeLattice.create({
            typeName: typeDeclaration.name,
            fields: Object.fromEntries(
                this.fields.map((field) => [
                    field.name,
                    field.value.currentValue({
                        ...context,
                        ...typeDeclaration.fields.find(
                            (f) => f.name === field.name,
                        )?.valueSet,
                    }),
                ]),
            ),
        })
    }

    toCIRExpression(
        context: Context & { targetValueSet: cir.ValueSet },
    ): cir.Expression {
        const valueSet = context.targetValueSet
        if (!valueSet || valueSet.type !== 'rc-type')
            logSemanticError(
                `DataLiteral.toCIRExpression: target valueSet must be of type rc-type`,
                { ...context, span: this.span, fatal: true },
            )

        const targetType = context.scope.dataDeclaration(valueSet.typeName) as
            DataDeclaration | undefined
        if (!targetType)
            logSemanticError(
                `DataLiteral.toCIRExpression: target type ${valueSet.typeName} not found in scope`,
                { ...context, span: this.span, fatal: true },
            )
        const fieldDeclarations = new Map(
            targetType.fields.map((field) => [field.name, field]),
        )
        return {
            kind: 'ALLOCATE',
            valueSet,
            fields: this.fields.map((field) => {
                const fieldDeclaration = fieldDeclarations.get(field.name)
                if (!fieldDeclaration)
                    // Nested literals need the declared field type as their target.
                    // Missing fields are rejected here so we do not propagate undefined types.
                    logSemanticError(
                        `DataLiteral.toCIRExpression: field ${field.name} not found on type ${valueSet.typeName}`,
                        { ...context, span: this.span, fatal: true },
                    )
                const nestedContext = {
                    ...context,
                    targetValueSet: fieldDeclaration.valueSet.toCIR(),
                }
                return {
                    name: field.name,
                    value: field.value.toCIRExpression(nestedContext),
                }
            }),
        }
    }
}

type FieldValue = {
    name: string
    value: Expression
}
