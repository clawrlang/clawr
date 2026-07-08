import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { FunctionName } from './function-name'

export class Query implements Expression {
    private arguments: Expression[]

    private constructor(
        private name: FunctionName,
        args: Expression[],
        public span: SourceCodeSpan,
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
        return new Query(
            FunctionName.create({
                baseName,
                labels: args
                    .filter((arg) => arg.label)
                    .map((arg) => arg.label!),
                arity: args.length,
            }),
            args.map((arg) => arg.value),
            span,
        )
    }

    isEffectivelyConst(_: Context): boolean {
        return true
    }

    valueSet(context: Context): cir.ValueSet {
        // TODO: Register function in scope and get return type from there
        // For now, just return truthvalue for all queries
        return this.arguments.length === 1
            ? {
                  ...this.arguments[0].valueSet(context),
                  ...{ semantics: 'UNIQUE' },
              }
            : { type: 'truthvalue' }
    }

    toCIRExpression(context: Context): cir.Expression {
        return {
            kind: 'CALL_FUNC',
            name: this.name.toCIR(),
            arguments: this.arguments.map((arg) =>
                arg.toCIRExpression(context),
            ),
            valueSet: this.valueSet(context),
        }
    }
}
