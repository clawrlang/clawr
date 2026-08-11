import * as cir from '../cir'
import { Context, Expression } from '.'
import { Failable } from './failable'
import { SourceCodeSpan } from '../diagnostics'
import { FunctionName } from './function-name'
import { Lattice, SharedTypeLattice, UniqueTypeLattice } from './lattice'

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

    isEffectivelyConst(_: Context): Failable<boolean> {
        return Failable.success(true)
    }

    semantics(context: Context): 'ISOLATED' | 'SHARED' | 'UNIQUE' {
        const value = this.currentValue(context).value()
        if (value instanceof UniqueTypeLattice) return 'UNIQUE'
        if (value instanceof SharedTypeLattice) return 'SHARED'
        return 'ISOLATED'
    }

    currentValue(context: Context): Failable<Lattice> {
        if (this.name.toString() === 'copy(of:)')
            return Failable.success(
                this.arguments[0].currentValue(context).value().asUNIQUE(),
            )

        const decl = context.scope.functionDeclaration(this.name.toString())
        if (!decl)
            return Failable.failure(
                `Function declaration not found: ${this.name.toString()}`,
                this.span,
            )

        const result = decl.resultLattice(context)
        if (!result)
            return Failable.failure(
                `Function declaration has no result lattice: ${this.name.toString()}`,
                this.span,
            )
        return Failable.success(result)
    }

    toCIRExpression(context: Context): Failable<cir.Expression> {
        return this.currentValue(context).map((valueSet) =>
            Failable.collect(
                this.arguments.map((arg) => arg.toCIRExpression(context)),
            ).map((args) =>
                Failable.success({
                    kind: 'CALL',
                    name: this.name.toCIR(),
                    arguments: args,
                    valueSet: valueSet.toCIR(),
                }),
            ),
        )
    }
}
