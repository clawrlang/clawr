import * as cir from '../cir'
import { Context, Expression, logSemanticError } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { FunctionName } from './function-name'
import { Lattice } from './lattice'

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

    currentValue(context: Context): Lattice {
        if (this.name.toString() === 'copy(of:)')
            return this.arguments[0].currentValue(context).asUNIQUE()

        const decl = context.scope.functionDeclaration(this.name.toString())
        if (!decl)
            logSemanticError(
                `Function declaration not found: ${this.name.toString()}`,
                { ...context, span: this.span, fatal: true },
            )
        return (
            decl.resultLattice(context) ??
            logSemanticError(
                `Function declaration has no result lattice: ${this.name.toString()}`,
                { ...context, span: this.span, fatal: true },
            )
        )
    }

    toCIRExpression(context: Context): cir.Expression {
        return {
            kind: 'QUERY',
            name: this.name.toCIR(),
            arguments: this.arguments.map((arg) =>
                arg.toCIRExpression(context),
            ),
            valueSet: this.currentValue(context).toCIR(),
        }
    }
}
