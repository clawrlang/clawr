import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { mapFilter } from '@/tools/map-filter'
import { isFailure, SemanticResult, Success } from '@/tools/semantic-result'
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
        return SemanticResult.true
    }

    isolationLevel(context: Context): SemanticResult<AnyIsolationLevel> {
        if (this.name.toString() === 'copy(of:)')
            return SemanticResult.value(UNIQUE)

        const decl = context.scope.functionDeclaration(this.name)
        if (!decl)
            return SemanticResult.failure(
                `unknown function ${this.name.toString()}`,
                this.span,
            )
        return decl.resultIsolationLevel(context)
    }

    declaredLattice(context: Context): SemanticResult<Lattice> {
        return this.currentValue(context)
    }

    currentValue(context: Context): SemanticResult<Lattice> {
        if (this.name.toString() === 'copy(of:)') {
            const valueResult = this.arguments[0].currentValue(context)
            if (isFailure(valueResult)) return valueResult
            const value = valueResult.value
            return value instanceof RCTypeLattice
                ? SemanticResult.value(value)
                : SemanticResult.failure(
                      'not a reference-counted type',
                      this.span,
                  )
        }

        const decl = context.scope.functionDeclaration(this.name)
        if (!decl)
            return SemanticResult.failure(
                `Function declaration not found: ${this.name.toString()}`,
                this.span,
            )

        const latticeResult = decl.lattice(context)
        if (isFailure(latticeResult)) return latticeResult
        if (!latticeResult.value)
            return SemanticResult.failure(
                `Function declaration has no result lattice: ${this.name.toString()}`,
                this.span,
            )
        return SemanticResult.value(latticeResult.value)
    }

    toCIRExpression(context: Context): SemanticResult<cir.Expression> {
        const argsResult = SemanticResult.collect([
            this.currentValue(context),
            ...this.arguments.map((arg) => arg.toCIRExpression(context)),
        ])

        if (isFailure(argsResult)) return argsResult
        const [value, ...args] = argsResult.value

        return SemanticResult.value({
            kind: 'CALL',
            name: this.name.toCIR(),
            arguments: args,
            value: value.toCIR(),
        } satisfies cir.Expression)
    }

    emitStatement(context: Context): SemanticResult {
        const argsResult = SemanticResult.collect(
            this.arguments.map((arg) => arg.toCIRExpression(context)),
        )
        if (isFailure(argsResult)) return argsResult
        const args = argsResult.value
        const _name = this.name.toCIR()
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
        return SemanticResult.success
    }
}
