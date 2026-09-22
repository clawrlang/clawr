import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { mapFilter } from '@/tools/map-filter'
import { Result, SuccessResult } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import { Context, Expression, Statement } from '.'
import { FunctionName } from './function-name'
import { AnyIsolationLevel, UNIQUE } from './isolation-level'
import { RCTypeSet, ValueSet } from './value-set'

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

    isEffectivelyConst(): SuccessResult<true> {
        return Result.true
    }

    isolationLevel(context: Context): SemanticResult<AnyIsolationLevel> {
        if (this.name.toString() === 'copy(of:)') return Result.value(UNIQUE)

        const decl = context.scope.functionDeclaration(this.name)
        if (!decl)
            return SemanticErrorResult.failure(
                `unknown function ${this.name.toString()}`,
                this.span,
            )
        return decl.resultIsolationLevel(context)
    }

    domain(context: Context): SemanticResult<ValueSet> {
        return this.currentValue(context)
    }

    currentValue(context: Context): SemanticResult<ValueSet> {
        if (this.recipient) {
            const recipientDomainResult = this.recipient.domain(context)
            if (recipientDomainResult.isError) return recipientDomainResult
            const recipientDomain = recipientDomainResult.value
            if (!(recipientDomain instanceof RCTypeSet))
                return SemanticErrorResult.failure(
                    'Recipient must be rc-type',
                    this.recipient.span,
                )

            const typeDecl = context.scope.objectDeclaration(
                recipientDomain.type,
            )
            if (!typeDecl)
                return SemanticErrorResult.failure(
                    'Unknown type',
                    this.recipient.span,
                )

            const decl = typeDecl.method(this.name)
            if (!decl)
                return SemanticErrorResult.failure(
                    `Method declaration not found: ${this.name.toString()}`,
                    this.span,
                )

            const domainResult = decl.domain(typeDecl.injectSelf(context))
            if (domainResult.isError) return domainResult
            if (!domainResult.value)
                return SemanticErrorResult.failure(
                    `Method has no result set: ${this.name.toString()}`,
                    this.span,
                )
            return Result.value(domainResult.value)
        } else {
            if (this.name.toString() === 'copy(of:)') {
                const valueResult = this.arguments[0].currentValue(context)
                if (valueResult.isError) return valueResult
                const value = valueResult.value
                return value instanceof RCTypeSet
                    ? Result.value(value)
                    : SemanticErrorResult.failure(
                          'not a reference-counted type',
                          this.span,
                      )
            }

            const decl = context.scope.functionDeclaration(this.name)
            if (!decl)
                return SemanticErrorResult.failure(
                    `Function declaration not found: ${this.name.toString()}`,
                    this.span,
                )

            const domainResult = decl.domain(context)
            if (domainResult.isError) return domainResult
            if (!domainResult.value)
                return SemanticErrorResult.failure(
                    `Function declaration has no result set: ${this.name.toString()}`,
                    this.span,
                )
            return Result.value(domainResult.value)
        }
    }

    toCIRExpression(context: Context): SemanticResult<cir.Expression> {
        if (this.recipient) {
            const argsResult = SemanticResult.collect([
                this.currentValue(context),
                this.recipient.toCIRExpression(context),
                ...this.arguments.map((arg) => arg.toCIRExpression(context)),
            ])

            if (argsResult.isError) return argsResult
            const [value, recipient, ...args] = argsResult.value

            return Result.value({
                kind: 'CALL',
                name: this.name.toCIR(),
                arguments: args,
                receiver: {
                    dispatch: 'direct',
                    object: recipient as cir.Expression & {
                        value: { type: 'rc-type' | 'interface' }
                    },
                },
                value: value.toCIR(),
            } satisfies cir.Expression)
        } else {
            const argsResult = SemanticResult.collect([
                this.currentValue(context),
                ...this.arguments.map((arg) => arg.toCIRExpression(context)),
            ])

            if (argsResult.isError) return argsResult
            const [value, ...args] = argsResult.value

            return Result.value({
                kind: 'CALL',
                name: this.name.toCIR(),
                arguments: args,
                value: value.toCIR(),
            } satisfies cir.Expression)
        }
    }

    emitStatement(context: Context): SemanticResult {
        const argsResult = SemanticResult.collect(
            this.arguments.map((arg) => arg.toCIRExpression(context)),
        )
        if (argsResult.isError) return argsResult
        const args = argsResult.value
        const _name = this.name.toCIR()
        if (_name.baseName === 'print') {
            const tempName = context.scope.nextTempVar()
            const boxDomain = { ...args[0].value, boxed: true as const }
            context.scope.emitted.push(
                {
                    kind: 'VARIABLE_DECL',
                    name: tempName,
                    domain: boxDomain,
                    initialValue: {
                        kind: 'BOX',
                        expression: args[0],
                        value: boxDomain,
                    },
                },
                {
                    kind: 'CALL',
                    name: _name,
                    arguments: [
                        {
                            kind: 'VARIABLE_REF',
                            name: tempName,
                            value: boxDomain,
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
        return Result.ok
    }
}
