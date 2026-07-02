import * as cir from '../cir'
import { Expression, Context, ValueSet } from '.'
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

    valueSet(context: Context & { type: string }): ValueSet {
        if (!context.type)
            throw new Error('DataLiteral.valueSet: context.type is required')
        return { type: context.type }
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
        this.valueSet(context)
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
