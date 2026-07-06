import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'

export class Query implements Expression {
    private arguments: { label?: string; value: Expression }[] = []

    private constructor(
        public span: SourceCodeSpan,
        private baseName: string,
        args: { label?: string; value: Expression }[],
    ) {
        this.arguments = args
    }

    static create({
        baseName,
        arguments: args,
        span,
    }: {
        baseName: string
        arguments: { label?: string; value: Expression }[]
        span: SourceCodeSpan
    }): Query {
        return new Query(span, baseName, args)
    }

    isEffectivelyConst(_: Context): boolean {
        return true
    }

    semantics(_: Context) {
        return 'UNIQUE' as const
    }

    valueSet(_: Context): cir.ValueSet {
        // TODO: Register function in scope and get return type from there
        // For now, just return truthvalue for all queries
        return { type: 'truthvalue' }
    }

    toCIRExpression(context: Context): cir.Expression {
        return {
            kind: 'CALL_FUNC',
            signature: {
                baseName: this.baseName,
                parameters: this.arguments.map((arg, index) => ({
                    label: this.arguments[index].label,
                    type: arg.value.valueSet(context).type,
                })),
            },
            arguments: this.arguments.map((arg) =>
                arg.value.toCIRExpression(context),
            ),
        }
    }
}
