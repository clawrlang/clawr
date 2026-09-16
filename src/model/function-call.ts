import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, Result, Success } from '@/tools/failable'
import { mapFilter } from '@/tools/map-filter'
import { Context, Expression, Statement } from '.'
import { FunctionName } from './function-name'
import { AnyIsolationLevel, UNIQUE } from './isolation-level'
import { Lattice, RCTypeLattice } from './lattice'

export class FunctionCall implements Expression, Statement {
    private arguments: Expression[]

    private constructor(
        private readonly name: FunctionName,
        private readonly recipient: Expression | undefined,
        args: Expression[],
        public readonly span: SourceCodeSpan,
    ) {
        this.arguments = args
    }

    static create({
        baseName,
        recipient,
        arguments: args,
        span,
    }: {
        baseName: string
        recipient?: Expression
        arguments: { label?: string; value: Expression }[]
        span: SourceCodeSpan
    }): FunctionCall {
        return new FunctionCall(
            FunctionName.create({
                baseName,
                labels: mapFilter(args, (arg) => arg.label),
                arity: args.length,
            }),
            recipient,
            args.map((arg) => arg.value),
            span,
        )
    }

    isEffectivelyConst(): Success<true> {
        return Result.true
    }

    isolationLevel(context: Context): Result<AnyIsolationLevel> {
        if (this.name.toString() === 'copy(of:)') return Result.value(UNIQUE)

        const decl = context.scope.functionDeclaration(this.name)
        if (!decl)
            return Result.failure(
                `unknown function ${this.name.toString()}`,
                this.span,
            )
        return Failable.do(function* () {
            return yield* decl.resultIsolationLevel(context)
        })
    }

    declaredLattice(context: Context): Result<Lattice> {
        return this.currentValue(context)
    }

    currentValue(context: Context): Result<Lattice> {
        const self = this
        return Failable.do(function* () {
            if (self.name.toString() === 'copy(of:)') {
                const value = yield self.arguments[0].currentValue(context)
                return value instanceof RCTypeLattice
                    ? Result.value(value)
                    : Result.failure('not a reference-counted type', self.span)
            }

            const decl = context.scope.functionDeclaration(self.name)
            if (!decl)
                return Result.failure(
                    `Function declaration not found: ${self.name.toString()}`,
                    self.span,
                )

            const lattice: Lattice | undefined =
                yield yield* decl.lattice(context)
            if (!lattice)
                return Result.failure(
                    `Function declaration has no result lattice: ${self.name.toString()}`,
                    self.span,
                )
            return Result.value(lattice)
        })
    }

    toCIRExpression(context: Context): Result<cir.Expression> {
        const self = this
        return Failable.do(function* () {
            const value: Lattice = yield self.currentValue(context)
            const args: cir.Expression[] = yield yield* Failable.map(
                self.arguments,
                function* (arg) {
                    return arg.toCIRExpression(context)
                },
            )
            return Result.value({
                kind: 'CALL',
                name: self.name.toCIR(),
                arguments: args,
                value: value.toCIR(),
            } satisfies cir.Expression)
        })
    }

    *emitStatement(context: Context): Failable {
        const _name = this.name.toCIR()
        const args: cir.Expression[] = yield yield* Failable.map(
            this.arguments,
            function* (arg) {
                return arg.toCIRExpression(context)
            },
        )
        if (_name.baseName === 'print') {
            const tempName = context.scope.nextTempVar()
            const boxedLattice = { ...args[0].value, boxed: true as const }
            context.scope.emitted.push(
                {
                    kind: 'VARIABLE_DECL',
                    name: tempName,
                    lattice: boxedLattice,
                    initialValue: {
                        kind: 'BOX',
                        expression: args[0],
                        value: boxedLattice,
                    },
                },
                {
                    kind: 'CALL',
                    name: _name,
                    arguments: [
                        {
                            kind: 'VARIABLE_REF',
                            name: tempName,
                            value: boxedLattice,
                        },
                    ],
                },
                {
                    kind: 'RELEASE',
                    object: {
                        kind: 'VARIABLE_REF',
                        name: tempName,
                    },
                },
            )
        } else {
            context.scope.emitted.push({
                kind: 'CALL',
                name: _name,
                arguments: args,
            })
        }
        return Result.success
    }
}
