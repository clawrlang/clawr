import { Context, Expression, Statement } from '@/model'
import { FunctionDeclaration } from '@/model/function-declaration'
import { FunctionName } from '@/model/function-name'
import { AnyIsolationLevel, UNIQUE } from '@/model/isolation-level'
import { TypeName } from '@/model/type-name'
import {
    IntegerSet,
    RCTypeSet,
    RealSet,
    TruthvalueSet,
    StringSet,
    ValueSet,
} from '@/model/value-set'
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
        private readonly nameSpan: SourceCodeSpan,
    ) {
        this.arguments = args
    }

    static create({
        baseName,
        recipient,
        arguments: args,
        span,
        nameSpan,
    }: {
        baseName: string
        recipient?: Expression
        arguments: { label?: string; value: Expression }[]
        span: SourceCodeSpan
        nameSpan?: SourceCodeSpan
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
            nameSpan ?? span,
        )
    }

    withTarget(target: Expression) {
        return new FunctionCall(
            this.name,
            target,
            this.arguments,
            this.span,
            this.nameSpan,
        )
    }

    isEffectivelyConst(): SuccessResult<true> {
        return Result.true
    }

    isolationLevel(context: Context): SemanticResult<AnyIsolationLevel> {
        if (this.name.toString() === 'copy(of:)') return Result.value(UNIQUE)

        if (this.recipient) {
            const type = this.recipient.type(context)
            if (type.isError) return type
            if (!(type.value instanceof RCTypeSet)) return Result.value(UNIQUE)
            const found = context.scope
                .objectDeclaration(type.value.type)
                ?.lookupMethod(this.name, context)
            return found
                ? found.declaration.resultIsolationLevel(
                      found.owner.injectSelf(context),
                  )
                : Result.value(UNIQUE)
        }

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

            const interfaceDecl = context.scope.interfaceDeclaration(
                recipientType.type,
            )
            if (interfaceDecl) {
                const required = interfaceDecl.method(this.name, context)
                if (!required)
                    return SemanticErrorResult.failure(
                        `Method declaration not found: ${this.name.toString()}`,
                        this.span,
                    )
                if (required.usesSelf())
                    return SemanticErrorResult.failure(
                        'Methods involving Self cannot be called on a trait-typed value',
                        this.span,
                    )
                return required.result
                    ? Result.value(required.result)
                    : SemanticErrorResult.failure(
                          `Method has no result set: ${this.name.toString()}`,
                          this.span,
                      )
            }

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
                if (
                    value instanceof RCTypeSet &&
                    context.scope.objectDeclaration(value.type)?.opaque
                )
                    return SemanticErrorResult.failure(
                        'Opaque services cannot be copied',
                        this.span,
                    )
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
            const declaration = this.recipientDeclaration(context)
            if (declaration.isError) return declaration
            const args = this.argumentsToCIR(context, declaration.value)
            if (args.isError) return args
            const argsResult = SemanticResult.collect([
                this.currentValue(context),
                this.recipient.toCIRExpression(context),
            ])

            if (argsResult.isError) return argsResult
            const [value, recipient] = argsResult.value

            return Result.value({
                kind: 'CALL',
                name: this.callName(context),
                arguments: args.value,
                receiver: this.receiver(context, recipient),
                type: context.scope.toCIRType(value),
            } satisfies cir.Expression)
        } else {
            this.recordDefinition(context)
            const valueResult = this.currentValue(context)
            if (valueResult.isError) return valueResult
            const argsResult = this.argumentsToCIR(
                context,
                context.scope.functionDeclaration(this.name),
            )
            if (argsResult.isError) return argsResult

            return Result.value({
                kind: 'CALL',
                name: this.callName(context),
                arguments: argsResult.value,
                type: context.scope.toCIRType(valueResult.value),
            } satisfies cir.Expression)
        }
    }

    emitStatement(context: Context): SemanticResult {
        const receiver = this.recipientDeclaration(context)
        if (receiver.isError) return receiver
        const declaration = this.recipient
            ? receiver.value
            : this.name.toString() !== 'copy(of:)'
              ? context.scope.functionDeclaration(this.name)
              : undefined
        if (!this.recipient) this.recordDefinition(context)
        if (
            !this.recipient &&
            this.name.toString() !== 'copy(of:)' &&
            !declaration
        )
            return SemanticErrorResult.failure(
                `Function declaration not found: ${this.name.toString()}`,
                this.span,
            )
        const argsResult = this.argumentsToCIR(context, declaration)
        if (argsResult.isError) return argsResult
        const releases: cir.Statement[] = []
        let recipientCIR = this.maybeRecipientCIR(context)
        if (
            recipientCIR &&
            recipientCIR.type.universe === 'rc-type' &&
            context.scope.objectDeclaration(TypeName.create(recipientCIR.type))
                ?.opaque &&
            recipientCIR.kind !== 'VARIABLE_REF' &&
            recipientCIR.kind !== 'PROPERTY_REF'
        ) {
            const name = context.scope.nextTempVar()
            context.scope.emitted.push({
                kind: 'VARIABLE_DECL',
                name,
                type: recipientCIR.type,
                initialValue: recipientCIR,
            })
            releases.push({
                kind: 'RELEASE',
                object: { kind: 'VARIABLE_REF', name },
            })
            recipientCIR = {
                kind: 'VARIABLE_REF',
                name,
                type: recipientCIR.type,
            }
        }
        const args = argsResult.value.map((arg) => {
            if (arg.kind !== 'BOX') return arg
            const name = context.scope.nextTempVar()
            context.scope.emitted.push({
                kind: 'VARIABLE_DECL',
                name,
                type: arg.type,
                initialValue: arg,
            })
            releases.push({
                kind: 'RELEASE',
                object: { kind: 'VARIABLE_REF', name },
            })
            return { kind: 'VARIABLE_REF' as const, name, type: arg.type }
        })
        const _name = this.callName(context)
        context.scope.emitted.push({
            kind: 'CALL',
            name: _name,
            arguments: args,
            receiver: recipientCIR && this.receiver(context, recipientCIR),
        })
        context.scope.emitted.push(...releases)
        return Result.ok
    }

    private recordDefinition(context: Context): void {
        const definition = context.scope.functionDeclaration(
            this.name,
        )?.nameSpan
        if (definition)
            context.definitionRecorder?.functionReference(
                this.nameSpan,
                definition,
            )
    }

    private callName(context: Context) {
        if (!this.recipient) {
            const declaration = context.scope.functionDeclaration(this.name)
            let library = context.scope.parentScope
            while (library && library.namespace !== 'clawr')
                library = library.parentScope
            const type = declaration?.result?.type
            if (
                library &&
                declaration &&
                declaration === library.functionDeclaration(this.name) &&
                type instanceof RCTypeSet &&
                context.scope.objectDeclaration(type.type)?.opaque
            )
                return { ...this.name.toCIR(), namespace: library.namespace }
        }
        return this.name.toCIR()
    }

    private argumentsToCIR(
        context: Context,
        declaration?: Pick<FunctionDeclaration, 'parameters'>,
    ): SemanticResult<cir.Expression[]> {
        const result: cir.Expression[] = []
        for (const [index, argument] of this.arguments.entries()) {
            const converted = argument.toCIRExpression(context)
            if (converted.isError) return converted
            const parameter = declaration?.parameters[index]?.type
            if (
                parameter instanceof RCTypeSet &&
                context.scope.objectDeclaration(parameter.type)?.opaque
            ) {
                const actual = argument.currentValue(context)
                if (actual.isError) return actual
                if (
                    !(actual.value instanceof RCTypeSet) ||
                    context.scope.objectDeclaration(actual.value.type) !==
                        context.scope.objectDeclaration(parameter.type)
                )
                    return SemanticErrorResult.failure(
                        'Argument must be a HashBuilder',
                        argument.span,
                    )
                const isolation = argument.isolationLevel(context)
                if (isolation.isError) return isolation
                if (isolation.value === 'ISOLATED')
                    return SemanticErrorResult.failure(
                        'HashBuilder must be shared',
                        argument.span,
                    )
            }
            if (parameter instanceof TruthvalueSet) {
                const value = argument.currentValue(context)
                if (value.isError) return value
                if (!(value.value instanceof TruthvalueSet))
                    return SemanticErrorResult.failure(
                        'Argument must be a truthvalue',
                        argument.span,
                    )
            }
            const iface =
                parameter instanceof RCTypeSet
                    ? context.scope.interfaceDeclaration(parameter.type)
                    : undefined
            if (!iface) {
                result.push(converted.value)
                continue
            }
            const value = argument.currentValue(context)
            if (value.isError) return value
            if (value.value instanceof RCTypeSet) {
                const actual = value.value.type
                if (
                    !context.scope
                        .interfaceDeclaration(actual)
                        ?.hierarchy(context)
                        .includes(iface) &&
                    !context.scope
                        .objectDeclaration(actual)
                        ?.conformsTo(iface.name, context)
                )
                    return SemanticErrorResult.failure(
                        `Argument does not conform to ${iface.name.name}`,
                        argument.span,
                    )
                result.push(converted.value)
                continue
            }
            let library = context.scope.parentScope
            while (library && library.namespace !== 'clawr')
                library = library.parentScope
            if (
                library?.interfaceDeclaration(iface.name) !== iface ||
                ![
                    'HasStringRepresentation',
                    'HashEquatable',
                    'Equatable',
                ].includes(iface.name.name) ||
                !(
                    value.value instanceof IntegerSet ||
                    value.value instanceof RealSet ||
                    value.value instanceof TruthvalueSet ||
                    value.value instanceof StringSet
                )
            )
                return SemanticErrorResult.failure(
                    `Argument does not conform to ${iface.name.name}`,
                    argument.span,
                )
            if (value.value instanceof StringSet) {
                result.push(converted.value)
                continue
            }
            result.push({
                kind: 'BOX',
                expression: converted.value,
                type: { ...converted.value.type, boxed: true },
            })
        }
        return Result.value(result)
    }

    private recipientDeclaration(
        context: Context,
    ): SemanticResult<Pick<FunctionDeclaration, 'parameters'> | undefined> {
        if (!this.recipient) return Result.value(undefined)
        const type = this.recipient.type(context)
        if (type.isError) return type
        if (!(type.value instanceof RCTypeSet))
            return SemanticErrorResult.failure(
                'Recipient must be rc-type',
                this.recipient.span,
            )
        const iface = context.scope.interfaceDeclaration(type.value.type)
        const object = context.scope.objectDeclaration(type.value.type)
        if (object?.opaque) {
            const isolation = this.recipient.isolationLevel(context)
            if (isolation.isError) return isolation
            if (isolation.value === 'ISOLATED')
                return SemanticErrorResult.failure(
                    'HashBuilder must be shared',
                    this.recipient.span,
                )
        }
        const requirement = iface?.method(this.name, context)
        if (requirement?.usesSelf())
            return SemanticErrorResult.failure(
                'Methods involving Self cannot be called on a trait-typed value',
                this.span,
            )
        const declaration =
            requirement ??
            object?.lookupMethod(this.name, context)?.declaration ??
            object?.initializer(this.name)
        if (!declaration)
            return SemanticErrorResult.failure(
                `Method declaration not found: ${this.name.toString()}`,
                this.span,
            )
        return Result.value(declaration)
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
        const argsResult = this.argumentsToCIR(
            context,
            context.scope.objectDeclaration(superType)?.initializer(this.name),
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

    private receiver(context: Context, object: cir.Expression): Receiver {
        const type = this.recipient?.type(context)
        const typeName =
            type && !type.isError && type.value instanceof RCTypeSet
                ? type.value.type
                : undefined
        const declaration =
            typeName && context.scope.interfaceDeclaration(typeName)
        if (declaration)
            return {
                dispatch: 'conformance',
                object: {
                    ...object,
                    type: {
                        universe: 'interface',
                        ...declaration.name.toCIR(),
                    },
                },
            } as Receiver
        const opaque = typeName && context.scope.objectDeclaration(typeName)
        if (opaque?.opaque && isRCExpression(object))
            return { dispatch: 'direct', object }
        return { dispatch: this.dispatchKind(context), object } as any
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

type Receiver = Extract<cir.Expression, { kind: 'CALL' }>['receiver']

function isRCExpression(
    expression: cir.Expression,
): expression is cir.Expression & {
    type: Extract<cir.ValueSet, { universe: 'rc-type' }>
} {
    return expression.type.universe === 'rc-type'
}
