import * as cir from '../cir'
import { AnyIsolationLevel, Context, Expression } from '.'
import { Failable, SemanticError } from './failable'
import { SourceCodeSpan } from '../diagnostics'
import { FunctionName } from './function-name'
import { Lattice, RCTypeLattice } from './lattice'
import { mapFilter } from '../tools/map-filter'

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
                labels: mapFilter(args, (arg) => arg.label),
                arity: args.length,
            }),
            args.map((arg) => arg.value),
            span,
        )
    }

    isEffectivelyConst(_: Context): Failable<boolean> {
        return Failable.success(true)
    }

    isolationLevel(context: Context): AnyIsolationLevel {
        if (this.name.toString() === 'copy(of:)') return 'UNIQUE'

        const decl = context.scope.functionDeclaration(this.name.toString())
        if (!decl)
            throw SemanticError.create({
                message: `unknown function ${this.name.toString()}`,
                span: this.span,
            })
        return decl?.resultIsolationLevel(context)
    }

    declaredValueSet(context: Context): Failable<Lattice> {
        return this.currentValue(context)
    }

    currentValue(context: Context): Failable<Lattice> {
        if (this.name.toString() === 'copy(of:)') {
            const value = this.arguments[0].currentValue(context).value()
            return value instanceof RCTypeLattice
                ? Failable.success(value)
                : Failable.failure('not a reference-counted type', this.span)
        }

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
        return this.currentValue(context).chaining((valueSet) =>
            Failable.collect(
                this.arguments.map((arg) => arg.toCIRExpression(context)),
            ).chaining((args) =>
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
