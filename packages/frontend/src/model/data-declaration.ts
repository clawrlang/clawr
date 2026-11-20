import { Context, Declaration, Expression } from '@/model'
import type { ExtensionDeclaration } from '@/model/extension-declaration'
import { FunctionCall } from '@/model/function-call'
import { FunctionDeclaration } from '@/model/function-declaration'
import { FunctionName } from '@/model/function-name'
import { IsolationLevel } from '@/model/isolation-level'
import { IntegerLiteral } from '@/model/literals'
import { StringLiteral } from '@/model/literals/string-literal'
import { Parameter } from '@/model/parameter'
import { PropertyReference } from '@/model/property-reference'
import {
    decorateTypeConstraint,
    TypeConstraintDeclaration,
} from '@/model/type-constraint-declaration'
import { TypeName } from '@/model/type-name'
import {
    IntegerSet,
    RCTypeSet,
    RealSet,
    StringSet,
    TruthvalueSet,
} from '@/model/value-set'
import { VariableReference } from '@/model/variable-reference'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export type Property = {
    isImmutable: boolean
    name: string
    isolationLevel: IsolationLevel
    type: TypeConstraintDeclaration
    defaultValue?: Expression
}

export class DataDeclaration implements Declaration {
    private constructor(
        public name: TypeName,
        public properties: Property[],
        public readonly span?: SourceCodeSpan,
    ) {}

    static create({
        name,
        properties,
        span,
    }: {
        name: TypeName
        properties: Property[]
        span?: SourceCodeSpan
    }): DataDeclaration {
        return new DataDeclaration(name, properties, span)
    }

    registerDeclaration(context: Context): void {
        context.scope.rootScope.addDataDeclaration(this)
    }

    lookupMethod(
        name: FunctionName,
        context: Context,
        includeSynthesized = true,
    ): FunctionDeclaration | undefined {
        const method = context.scope.rootScope
            .extensionDeclarations(this.name)
            .flatMap((extension: ExtensionDeclaration) => [
                ...extension.methods,
                ...extension.mutating,
            ])
            .find((method) => method.name().toString() === name.toString())
        if (method) return method
        if (
            includeSynthesized &&
            name.toString() === 'serialize(into:)' &&
            this.shouldSynthesizeSerializer(context)
        )
            return this.synthesizedSerializer()
        return undefined
    }

    extensionMethodIsMutating(name: FunctionName, context: Context): boolean {
        return context.scope.rootScope
            .extensionDeclarations(this.name)
            .some((extension) =>
                extension.mutating.some(
                    (method) => method.name().toString() === name.toString(),
                ),
            )
    }

    injectSelf(context: Context): Context {
        const scope = context.scope.createChildScope()
        scope.addSelfVariable(this.name)
        return { ...context, scope }
    }

    conformsTo(name: TypeName, context: Context): boolean {
        const serializable = context.scope.interfaceDeclaration(
            TypeName.create({
                name: 'Serializable',
                namespace: 'clawr',
            }),
        )
        if (
            !!serializable &&
            name.canonical() === serializable.name.canonical() &&
            this.implicitlySerializable(context, new Set())
        )
            return true
        const target = context.scope.interfaceDeclaration(name)
        if (!target) return false
        return context.scope.rootScope
            .extensionDeclarations(this.name)
            .some(
                (extension) =>
                    !!extension.conformance &&
                    context.scope
                        .interfaceDeclaration(extension.conformance)
                        ?.hierarchy(context)
                        .includes(target),
            )
    }

    emitDeclaration(context: Context): SemanticResult {
        context.scope.rootScope.addDataDeclaration(this)
        const extensions = context.scope.rootScope.extensionDeclarations(
            this.name,
        )
        if (
            this.shouldSynthesizeSerializer(context) &&
            extensions.some((extension) =>
                [...extension.methods, ...extension.mutating].some(
                    (method) => method.name().toString() === 'serialize(into:)',
                ),
            )
        )
            return SemanticErrorResult.failure(
                'A custom serialize(into:) implementation requires explicit Serializable conformance',
                this.span ?? {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 1 },
                },
            )
        const extensionMethods = new Map<
            ExtensionDeclaration,
            (cir.Declaration & { kind: 'FUNCTION_DECL' })[]
        >()
        for (const extension of extensions) {
            const methodsResult = SemanticResult.collect(
                [...extension.methods, ...extension.mutating].map((method) =>
                    method.emitMethod(this.injectSelf(context)),
                ),
            )
            if (methodsResult.isError) return methodsResult
            extensionMethods.set(extension, methodsResult.value)
        }

        const extensionConformances = this.checkExtensionConformances(
            context,
            extensions,
            [...extensionMethods.values()].flat(),
        )
        if (extensionConformances.isError) return extensionConformances

        context.scope.rootScope.emitted.push({
            kind: 'RC_TYPE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            properties: this.properties.map((property) => ({
                name: property.name,
                type: context.scope.toCIRType(property.type!),
            })),
        })
        if (this.shouldSynthesizeSerializer(context)) {
            const method = this.synthesizedSerializer().emitMethod(
                this.injectSelf(context),
            )
            if (method.isError) return method
            context.scope.rootScope.emitted.push({
                kind: 'EXTENSION_DECL',
                target: this.name.toCIR(),
                methods: [method.value],
                conformances: [
                    {
                        interface: { name: 'Serializable', namespace: 'clawr' },
                        fulfillments: [
                            {
                                requirement: {
                                    baseName: 'serialize',
                                    labels: ['into'],
                                },
                                implementation: {
                                    baseName: 'serialize',
                                    labels: ['into'],
                                },
                            },
                        ],
                    },
                ],
            })
        }
        for (const extension of extensions) {
            const conformances =
                extensionConformances.value.get(extension) ?? []
            context.scope.rootScope.emitted.push({
                kind: 'EXTENSION_DECL',
                target: this.name.toCIR(),
                methods: extensionMethods.get(extension) ?? [],
                ...(conformances.length > 0 && { conformances }),
            })
        }
        return Result.ok
    }

    private checkExtensionConformances(
        context: Context,
        extensions: ExtensionDeclaration[],
        methods: (cir.Declaration & { kind: 'FUNCTION_DECL' })[],
    ): SemanticResult<
        Map<
            ExtensionDeclaration,
            NonNullable<
                Extract<
                    cir.Declaration,
                    { kind: 'EXTENSION_DECL' }
                >['conformances']
            >
        >
    > {
        type Conformance = NonNullable<
            Extract<cir.Declaration, { kind: 'EXTENSION_DECL' }>['conformances']
        >[number]
        const conformances = new Map<ExtensionDeclaration, Conformance[]>()
        for (const extension of extensions) {
            if (!extension.conformance) continue
            const extensionConformances: Conformance[] = []
            const seen = new Set<string>()
            const declaration = context.scope.interfaceDeclaration(
                extension.conformance,
            )
            if (!declaration)
                return SemanticErrorResult.failure(
                    `${extension.conformance.name} is not a trait or role`,
                    extension.span,
                )
            for (const inherited of declaration.hierarchy(context)) {
                if (seen.has(inherited.name.canonical())) continue
                seen.add(inherited.name.canonical())
                const fulfillments: Conformance['fulfillments'] = []
                for (const requirement of inherited.resolvedMethods(context)) {
                    const requirementCIR = requirement.toCIR(context, this.name)
                    if (requirementCIR.isError) return requirementCIR
                    const implementation = methods.find(
                        (method) =>
                            method.baseName === requirement.baseName &&
                            method.labels.length ===
                                requirementCIR.value.labels.length &&
                            method.labels.every(
                                (label, index) =>
                                    label ===
                                    requirementCIR.value.labels[index],
                            ),
                    )
                    const implementationDeclaration = extensions
                        .flatMap((candidate) => [
                            ...candidate.methods,
                            ...candidate.mutating,
                        ])
                        .find(
                            (method) =>
                                method.name().toString() ===
                                requirement.name().toString(),
                        )
                    if (!implementation)
                        return SemanticErrorResult.failure(
                            `${this.name.name} does not implement ${inherited.name.name}.${requirement.baseName}`,
                            extension.span,
                        )
                    if (
                        extensions.some((candidate) =>
                            candidate.mutating.some(
                                (method) =>
                                    method.name().toString() ===
                                    requirement.name().toString(),
                            ),
                        )
                    )
                        return SemanticErrorResult.failure(
                            `Mutating method ${requirement.baseName} cannot implement a trait or role requirement`,
                            extension.span,
                        )
                    if (
                        JSON.stringify(
                            implementation.parameters.map(
                                (parameter) => parameter.type,
                            ),
                        ) !==
                        JSON.stringify(
                            requirementCIR.value.parameters.map(
                                (parameter) => parameter.type,
                            ),
                        )
                    )
                        return SemanticErrorResult.failure(
                            `${this.name.name}.${requirement.baseName} must have the same signature as the requirement in ${inherited.name.name}`,
                            extension.span,
                        )
                    if (!requirement.result) {
                        if (implementation.returnType.universe !== 'void')
                            return SemanticErrorResult.failure(
                                `${this.name.name}.${requirement.baseName} must not return a value`,
                                extension.span,
                            )
                    } else {
                        if (!implementationDeclaration)
                            return SemanticErrorResult.failure(
                                `${this.name.name} does not implement ${inherited.name.name}.${requirement.baseName}`,
                                extension.span,
                            )
                        const resultType = implementationDeclaration.type(
                            this.injectSelf(context),
                        )
                        if (resultType.isError) return resultType
                        const expected =
                            requirement.result instanceof RCTypeSet &&
                            requirement.result.type.name === 'Self'
                                ? RCTypeSet.create({ type: this.name })
                                : requirement.result
                        if (
                            !resultType.value ||
                            !expected.isSupersetTo(resultType.value)
                        )
                            return SemanticErrorResult.failure(
                                `${this.name.name}.${requirement.baseName} must have a result compatible with the requirement in ${inherited.name.name}`,
                                extension.span,
                            )
                    }
                    fulfillments.push({
                        requirement: {
                            baseName: requirementCIR.value.baseName,
                            labels: requirementCIR.value.labels,
                        },
                        implementation: {
                            baseName: implementation.baseName,
                            labels: implementation.labels,
                        },
                    })
                }
                extensionConformances.push({
                    interface: inherited.name.toCIR(),
                    fulfillments,
                })
            }
            conformances.set(extension, extensionConformances)
        }
        return Result.value(conformances)
    }

    private implicitlySerializable(
        context: Context,
        visiting: Set<DataDeclaration>,
    ): boolean {
        if (visiting.has(this)) return true
        visiting.add(this)
        const result = this.properties.every((property) => {
            if (property.isolationLevel === 'SHARED') return false
            const type = property.type
            if (
                type instanceof IntegerSet ||
                type instanceof RealSet ||
                type instanceof TruthvalueSet ||
                type instanceof StringSet
            )
                return true
            if (type instanceof RCTypeSet) {
                const nested = context.scope.dataDeclaration(type.type)
                return (
                    !!nested && nested.implicitlySerializable(context, visiting)
                )
            }
            return false
        })
        visiting.delete(this)
        return result
    }

    private shouldSynthesizeSerializer(context: Context): boolean {
        const serializable = context.scope.interfaceDeclaration(
            TypeName.create({
                name: 'Serializable',
                namespace: 'clawr',
            }),
        )
        return (
            !!serializable &&
            !context.scope.rootScope
                .extensionDeclarations(this.name)
                .some(
                    (extension) =>
                        !!extension.conformance &&
                        context.scope
                            .interfaceDeclaration(extension.conformance)
                            ?.hierarchy(context)
                            .includes(serializable),
                ) &&
            this.implicitlySerializable(context, new Set())
        )
    }

    private synthesizedSerializer(): FunctionDeclaration {
        const span = this.span ?? {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 1 },
        }
        const serializer = VariableReference.create({
            name: 'serializer',
            span,
        })
        const call = (
            baseName: string,
            args: { label?: string; value: Expression }[],
        ) =>
            FunctionCall.create({
                baseName,
                recipient: serializer,
                arguments: args,
                span,
            })
        return FunctionDeclaration.create({
            annotations: [],
            baseName: 'serialize',
            parameters: [
                Parameter.create({
                    isImmutable: true,
                    label: 'into',
                    varName: 'serializer',
                    isolationLevel: 'SHARED',
                    span,
                    type: decorateTypeConstraint(
                        RCTypeSet.create({
                            type: TypeName.create({
                                name: 'Serializer',
                                namespace: 'clawr',
                            }),
                        }),
                        { span },
                    ),
                }),
            ],
            result: undefined,
            span,
            implementation: {
                kind: 'body',
                statements: [
                    call('beginStructure', [
                        {
                            value: StringLiteral.create(
                                this.name.canonical(),
                                span,
                            ),
                        },
                        {
                            label: 'fieldCount',
                            value: IntegerLiteral.create({
                                value: BigInt(this.properties.length),
                                span,
                            }),
                        },
                    ]),
                    ...this.properties.map((property) =>
                        call('writeField', [
                            {
                                value: StringLiteral.create(
                                    property.name,
                                    span,
                                ),
                            },
                            {
                                label: 'value',
                                value: PropertyReference.create({
                                    object: VariableReference.create({
                                        name: 'self',
                                        span,
                                    }),
                                    operator: '->',
                                    property: property.name,
                                    span,
                                    propertySpan: span,
                                }),
                            },
                        ]),
                    ),
                    call('endStructure', []),
                ],
            },
        })
    }
}
