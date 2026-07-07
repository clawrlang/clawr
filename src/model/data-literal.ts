import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration, buildValueSet } from './data-declaration'

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

    valueSet(context: Context & { type: string }): cir.ValueSet {
        if (!context.type)
            throw new Error('DataLiteral.valueSet: context.type is required')
        switch (context.type) {
            case 'integer':
                return { type: 'integer' }
            case 'truthvalue':
                return { type: 'truthvalue' }
            case 'string':
                return { type: 'string' }
            default:
                return {
                    type: 'rc-type',
                    typeName: context.type,
                    semantics: 'UNIQUE',
                }
        }
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
            | DataDeclaration
            | undefined
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
                    type: fieldDeclaration.type,
                    targetValueSet: buildValueSet(fieldDeclaration),
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
