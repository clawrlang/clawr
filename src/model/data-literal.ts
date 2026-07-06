import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration } from './data-declaration'

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
        const targetType = context.scope.declarations.get(valueSet.typeName) as
            | DataDeclaration
            | undefined
        if (!targetType)
            context.errorReporter.reportFatalError(
                `DataLiteral.toCIRExpression: target type ${valueSet.typeName} not found in scope`,
                this.span,
            )
        return {
            kind: 'ALLOCATE',
            valueSet,
            fields: this.fields.map((field) => ({
                name: field.name,
                // TODO: The fields need valueSet information, but we don't have that here. We need to look up the field type in the targetType declaration.
                value: field.value.toCIRExpression(context),
            })),
        }
    }
}

type FieldValue = {
    name: string
    value: Expression
}
