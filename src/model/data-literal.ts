import * as cir from '../cir'
import { Context, Expression } from '.'
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
            context.errorReporter.reportFatalError(
                `DataLiteral.currentValue: type ${context.typeName} not found in scope`,
                this.span,
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
            context.errorReporter.reportFatalError(
                'DataLiteral.toCIRExpression: target valueSet must be of type rc-type',
                this.span,
            )
        const targetType = context.scope.dataDeclaration(valueSet.typeName) as
            DataDeclaration | undefined
        if (!targetType)
            context.errorReporter.reportFatalError(
                `DataLiteral.toCIRExpression: target type ${valueSet.typeName} not found in scope`,
                this.span,
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
                    context.errorReporter.reportFatalError(
                        `DataLiteral.toCIRExpression: field ${field.name} not found on type ${valueSet.typeName}`,
                        this.span,
                    )
                const nestedContext = {
                    ...context,
                    targetValueSet: fieldDeclaration.valueSet.toCIR({
                        semantics: 'COW',
                    }),
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
