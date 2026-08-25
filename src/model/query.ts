import * as cir from '../cir'
import { Context, Expression } from '.'
import { AnyIsolationLevel, UNIQUE } from './isolation-level'
import { _Failable, SemanticError } from './failable'
import { SourceCodeSpan } from '../diagnostics'
import { FunctionName } from './function-name'
import { Lattice, RCTypeLattice } from './lattice'
import { mapFilter } from '../tools/map-filter'
import { Failable } from './gen-failable'

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
    _isEffectivelyConst(context: Context): _Failable<boolean> {
        const result = Failable.do(() => this.isEffectivelyConst(context))
        return _Failable.of(result)
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
        return decl.resultIsolationLevel(context).makeProper()
    }

    _isolationLevel(context: Context): _Failable<AnyIsolationLevel> {
        const result = Failable.do(() => this.isolationLevel(context))
        return _Failable.of(result)
    }

    declaredLattice(context: Context): Failable<Lattice> {
        return this.currentValue(context)
    }

    _declaredLattice(context: Context): _Failable<Lattice> {
        const result = Failable.do(() => this.declaredLattice(context))
        return _Failable.of(result)
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

        const result = decl.lattice(context)
        if (!result)
            return Failable.failure(
                `Function declaration has no result lattice: ${this.name.toString()}`,
                this.span,
            )
        return Failable.success(result)
    }

    _currentValue(context: Context): _Failable<Lattice> {
        const result = Failable.do(() => this.currentValue(context))
        return _Failable.of(result)
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

    _toCIRExpression(context: Context): _Failable<cir.Expression> {
        const result = Failable.do(() => this.toCIRExpression(context))
        return _Failable.of(result)
    }
}
