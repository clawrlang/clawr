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

    toCIRExpression(context: Context): cir.Expression {
        return {
            kind: 'QUERY',
            name: this.name.toCIR(),
            arguments: this.arguments.map((arg) =>
                arg.toCIRExpression(context),
            ),
            valueSet: this.cirValueSet(context),
        }
    }

    private cirValueSet(context: Context): cir.ValueSet {
        const name = this.name.toString()
        if (name === 'copy(of:)')
            return {
                ...this.arguments[0].toCIRExpression(context).valueSet,
                ...{ semantics: 'UNIQUE' },
            }
        const funcDecl = context.scope.functionDeclaration(name)
        if (!funcDecl)
            context.errorReporter.reportFatalError(
                `Function declaration not found: ${name}`,
                this.span,
            )
        const resultSet = funcDecl.resultSet(context)
        if (!resultSet)
            context.errorReporter.reportFatalError(
                `Function declaration has no result set: ${name}`,
                this.span,
            )
        return resultSet
    }
}
