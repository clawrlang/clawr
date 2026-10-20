import { Context, Expression, Statement } from '@/model'
import { FunctionName } from '@/model/function-name'
import { AnyIsolationLevel, UNIQUE } from '@/model/isolation-level'
import { TypeName } from '@/model/type-name'
import { RCTypeSet, ValueSet } from '@/model/value-set'
import { VariableReference } from '@/model/variable-reference'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { mapFilter } from '@/tools/map-filter'
import { Result, SuccessResult } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

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

    withTarget(target: Expression) {
        return new FunctionCall(this.name, target, this.arguments, this.span)
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

    type(context: Context): SemanticResult<ValueSet> {
        return this.currentValue(context)
    }

    currentValue(context: Context): SemanticResult<ValueSet> {
        if (this.recipient) {
            const recipientTypeResult = this.recipient.type(context)
            if (recipientTypeResult.isError) return recipientTypeResult
            const recipientType = recipientTypeResult.value
            if (!(recipientType instanceof RCTypeSet))
                return SemanticErrorResult.failure(
                    'Recipient must be rc-type',
                    this.recipient.span,
                )

            const typeDecl = context.scope.objectDeclaration(recipientType.type)
            if (!typeDecl)
                return SemanticErrorResult.failure(
                    'Unknown type',
                    this.recipient.span,
                )

            const found = typeDecl.lookupMethod(this.name, context)
            if (!found)
                return SemanticErrorResult.failure(
                    `Method declaration not found: ${this.name.toString()}`,
                    this.span,
                )

            const typeResult = found.declaration.type(
                found.owner.injectSelf(context),
            )
            if (typeResult.isError) return typeResult
            if (!typeResult.value)
                return SemanticErrorResult.failure(
                    `Method has no result set: ${this.name.toString()}`,
                    this.span,
                )
            return Result.value(typeResult.value)
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

            const typeResult = decl.type(context)
            if (typeResult.isError) return typeResult
            if (!typeResult.value)
                return SemanticErrorResult.failure(
                    `Function declaration has no result set: ${this.name.toString()}`,
                    this.span,
                )
            return Result.value(typeResult.value)
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
                    dispatch: this.dispatchKind(context),
                    object: recipient as any,
                },
                type: value.toCIR(),
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
                type: value.toCIR(),
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
            const boxType = { ...args[0].type, boxed: true as const }
            context.scope.emitted.push(
                {
                    kind: 'VARIABLE_DECL',
                    name: tempName,
                    type: boxType,
                    initialValue: {
                        kind: 'BOX',
                        expression: args[0],
                        type: boxType,
                    },
                },
                {
                    kind: 'CALL',
                    name: _name,
                    arguments: [
                        {
                            kind: 'VARIABLE_REF',
                            name: tempName,
                            type: boxType,
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
            const recipientCIR = this.maybeRecipientCIR(context)
            context.scope.emitted.push({
                kind: 'CALL',
                name: _name,
                arguments: args,
                receiver: recipientCIR && {
                    dispatch: this.dispatchKind(context),
                    object: recipientCIR as any,
                },
            })
        }
        return Result.ok
    }

    /**
     * Emits this call as the supertype initializer invocation of an
     * initializer that is running on `self`.
     */
    emitSuperInitializer(
        context: Context,
        superType: TypeName | undefined,
    ): SemanticResult {
        if (!superType)
            return SemanticErrorResult.failure(
                'Only a type with a supertype can call a supertype initializer',
                this.span,
            )
        if (
            !(this.recipient instanceof VariableReference) ||
            this.recipient.name !== superType.name
        )
            return SemanticErrorResult.failure(
                `The initializer must belong to the supertype ${superType.name}`,
                this.span,
            )
        const argsResult = SemanticResult.collect(
            this.arguments.map((arg) => arg.toCIRExpression(context)),
        )
        if (argsResult.isError) return argsResult

        context.scope.emitted.push({
            kind: 'CALL',
            name: this.name.toCIR(),
            arguments: argsResult.value,
            receiver: {
                dispatch: 'direct',
                object: {
                    kind: 'VARIABLE_REF',
                    name: 'self',
                    type: { universe: 'rc-type', ...superType.toCIR() },
                },
            },
        })
        return Result.ok
    }

    private dispatchKind(context: Context): 'direct' | 'inherited' {
        const type = this.recipient?.type(context)
        if (!type || type.isError || !(type.value instanceof RCTypeSet))
            return 'direct'
        const decl = context.scope.objectDeclaration(type.value.type)
        // Initializers are not methods and are never dispatched dynamically
        return decl?.lookupMethod(this.name, context) &&
            decl.isPolymorphic(context)
            ? 'inherited'
            : 'direct'
    }

    private maybeRecipientCIR(context: Context): cir.Expression | undefined {
        if (!this.recipient) return undefined

        const recipientTypeResult = this.recipient.type(context)
        if (recipientTypeResult.isError) return undefined
        const recipientResult =
            recipientTypeResult.value instanceof RCTypeSet
                ? this.recipient?.toCIRExpression(context)
                : undefined
        if (recipientResult?.isError) return undefined
        return recipientResult?.value
    }
}
