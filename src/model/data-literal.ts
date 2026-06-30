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
            throw new Error('DataLiteral.toCIR: context.type is required')
        return { type: context.type }
    }

    toCIR(context: Context & { type: string }): cir.Expression {
        this.valueSet(context)
        return {
            kind: 'ALLOCATE',
            type: context.type,
            semantics: 'REF',
            fields: this.fields.map((field) => ({
                name: field.name,
                value: field.value.toCIR(context),
            })),
        }
    }
}

type FieldValue = {
    name: string
    value: Expression
}
