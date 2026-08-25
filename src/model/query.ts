import * as cir from '../cir'
import { Context, Expression } from '.'
import { AnyIsolationLevel, UNIQUE } from './isolation-level'
import { SourceCodeSpan } from '../diagnostics'
import { FunctionName } from './function-name'
import { Lattice, RCTypeLattice } from './lattice'
import { mapFilter } from '../tools/map-filter'
import { Failable } from './failable'

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

    *isEffectivelyConst(_: Context): Failable<boolean> {
        return Failable.success(true)
    }

    *isolationLevel(context: Context): Failable<AnyIsolationLevel> {
        if (this.name.toString() === 'copy(of:)')
            return Failable.success(UNIQUE)

        const decl = context.scope.functionDeclaration(this.name.toString())
        if (!decl)
            return Failable.failure(
                `unknown function ${this.name.toString()}`,
                this.span,
            )
        return yield* decl.resultIsolationLevel(context)
    }

    declaredLattice(context: Context): Failable<Lattice> {
        return this.currentValue(context)
    }

    *currentValue(context: Context): Failable<Lattice> {
        if (this.name.toString() === 'copy(of:)') {
            const value = yield yield* this.arguments[0].currentValue(context)
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

        const lattice: Lattice | undefined = yield yield* decl.lattice(context)
        if (!lattice)
            return Failable.failure(
                `Function declaration has no result lattice: ${this.name.toString()}`,
                this.span,
            )
        return Failable.success(lattice)
    }

    *toCIRExpression(context: Context): Failable<cir.Expression> {
        const value: Lattice = yield yield* this.currentValue(context)
        const args: cir.Expression[] = yield yield* Failable.map(
            this.arguments,
            (arg) => arg.toCIRExpression(context),
        )
        return Failable.success({
            kind: 'CALL',
            name: this.name.toCIR(),
            arguments: args,
            value: value.toCIR(),
        } satisfies cir.Expression)
    }
}
