import * as cir from '../cir'
import { Context, Expression } from '.'
import { AnyIsolationLevel, UNIQUE } from './isolation-level'
import { _Failable, SemanticError } from './failable'
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

    _isEffectivelyConst(_: Context): _Failable<boolean> {
        return _Failable.success(true)
    }

    _isolationLevel(context: Context): _Failable<AnyIsolationLevel> {
        if (this.name.toString() === 'copy(of:)')
            return _Failable.success(UNIQUE)

        const decl = context.scope.functionDeclaration(this.name.toString())
        if (!decl)
            return _Failable.failure(
                `unknown function ${this.name.toString()}`,
                this.span,
            )
        return decl.resultIsolationLevel(context)
    }

    _declaredLattice(context: Context): _Failable<Lattice> {
        return this._currentValue(context)
    }

    _currentValue(context: Context): _Failable<Lattice> {
        if (this.name.toString() === 'copy(of:)') {
            const value = this.arguments[0]._currentValue(context).value()
            return value instanceof RCTypeLattice
                ? _Failable.success(value)
                : _Failable.failure('not a reference-counted type', this.span)
        }

        const decl = context.scope.functionDeclaration(this.name.toString())
        if (!decl)
            return _Failable.failure(
                `Function declaration not found: ${this.name.toString()}`,
                this.span,
            )

        const result = decl.lattice(context)
        if (!result)
            return _Failable.failure(
                `Function declaration has no result lattice: ${this.name.toString()}`,
                this.span,
            )
        return _Failable.success(result)
    }

    _toCIRExpression(context: Context): _Failable<cir.Expression> {
        return _Failable
            .collect([
                this._currentValue(context),
                ...this.arguments.map((arg) => arg._toCIRExpression(context)),
            ])
            .chaining(([value, ...args]) =>
                _Failable.success({
                    kind: 'CALL',
                    name: this.name.toCIR(),
                    arguments: args,
                    value: value.toCIR(),
                } satisfies cir.Expression),
            )
    }
}
