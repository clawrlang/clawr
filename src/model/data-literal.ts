import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'

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

    semantics(_: Context) {
        return 'UNIQUE' as const
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
        context: Context & { type: string; semantics: 'REF' | 'COW' },
    ): cir.Expression {
        if (!context.type)
            context.errorReporter.reportFatalError(
                'DataLiteral.toCIRExpression: context.type is required',
                this.span,
            )
        if (!context.semantics)
            context.errorReporter.reportFatalError(
                'DataLiteral.toCIRExpression: context.semantics is required',
                this.span,
            )
        if (!context.type || !context.semantics)
            throw new Error(
                'DataLiteral.toCIRExpression: context.type and context.semantics are required',
            )
        return {
            kind: 'ALLOCATE',
            type: context.type,
            semantics: context.semantics,
            fields: this.fields.map((field) => ({
                name: field.name,
                value: field.value.toCIRExpression(context),
            })),
        }
    }
}

type FieldValue = {
    name: string
    value: Expression
}
