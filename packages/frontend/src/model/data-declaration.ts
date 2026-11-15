import { Context, Declaration, Expression } from '@/model'
import { FunctionDeclaration } from '@/model/function-declaration'
import { FunctionName } from '@/model/function-name'
import type { ExtensionDeclaration } from '@/model/extension-declaration'
import { IsolationLevel } from '@/model/isolation-level'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { TypeName } from '@/model/type-name'
import {
    IntegerSet,
    RCTypeSet,
    RealSet,
    StringSet,
    TruthvalueSet,
} from '@/model/value-set'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import { SourceCodeSpan } from '@/tools/diagnostics'
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
        public readonly explicitlySerializable: boolean,
        public readonly serializer: FunctionDeclaration | undefined,
        public readonly span?: SourceCodeSpan,
    ) {}

    static create({
        name,
        properties,
        explicitlySerializable,
        serializer,
        span,
    }: {
        name: TypeName
        properties: Property[]
        explicitlySerializable?: boolean
        serializer?: FunctionDeclaration
        span?: SourceCodeSpan
    }): DataDeclaration {
        return new DataDeclaration(
            name,
            properties,
            explicitlySerializable ?? false,
            serializer,
            span,
        )
    }

    registerDeclaration(context: Context): void {
        context.scope.rootScope.addDataDeclaration(this)
    }

    lookupMethod(
        name: FunctionName,
        context: Context,
    ): FunctionDeclaration | undefined {
        if (this.serializer?.name().toString() === name.toString())
            return this.serializer
        return context.scope.rootScope
            .extensionDeclarations(this.name)
            .flatMap((extension: ExtensionDeclaration) => [
                ...extension.methods,
                ...extension.mutating,
            ])
            .find((method) => method.name().toString() === name.toString())
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
                name: 'JSONSerializable',
                namespace: 'clawr',
            }),
        )
        if (
            !!serializable &&
            name.canonical() === serializable.name.canonical() &&
            (this.implicitlyJSONSerializable(context, new Set()) ||
                (this.explicitlySerializable && !!this.serializer))
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
        if (
            this.explicitlySerializable &&
            !this.serializer &&
            !this.implicitlyJSONSerializable(context, new Set())
        )
            return SemanticErrorResult.failure(
                'A data type with non-serializable properties must define serialize: toJSON()',
                this.span ?? {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 1 },
                },
            )
        if (this.serializer && !this.explicitlySerializable)
            return SemanticErrorResult.failure(
                'A custom data serializer requires JSONSerializable conformance',
                this.serializer.span ??
                    this.span ?? {
                        start: { line: 1, column: 1 },
                        end: { line: 1, column: 1 },
                    },
            )
        if (this.serializer && !this.isValidSerializer(context))
            return SemanticErrorResult.failure(
                'A data serializer must be a non-extern toJSON() method returning string',
                this.serializer.span ??
                    this.span ?? {
                        start: { line: 1, column: 1 },
                        end: { line: 1, column: 1 },
                    },
            )
        const extensions = context.scope.rootScope.extensionDeclarations(
            this.name,
        )
        const extensionMethods = SemanticResult.collect(
            extensions
                .flatMap((extension) => [
                    ...extension.methods,
                    ...extension.mutating,
                ])
                .map((method) => method.emitMethod(this.injectSelf(context))),
        )
        if (extensionMethods.isError) return extensionMethods

        const extensionConformances = this.checkExtensionConformances(
            context,
            extensions,
            extensionMethods.value,
        )
        if (extensionConformances.isError) return extensionConformances

        let serializerMethod:
            (cir.Declaration & { kind: 'FUNCTION_DECL' }) | undefined
        if (this.serializer) {
            const serializerContext = this.injectSelf(context)
            const method = this.serializer.emitMethod(serializerContext)
            if (method.isError) return method
            serializerMethod = method.value
        }

        const serializable = this.conformsTo(
            TypeName.create({
                name: 'JSONSerializable',
                namespace: 'clawr',
            }),
            context,
        )
        const jsonConformance = serializable
            ? [
                  {
                      interface: {
                          name: 'JSONSerializable',
                          namespace: 'clawr',
                      },
                      fulfillments: [
                          {
                              requirement: {
                                  baseName: 'toJSON',
                                  labels: [],
                              },
                              implementation: {
                                  baseName: 'toJSON',
                                  labels: [],
                              },
                          },
                      ],
                  },
              ]
            : []
        const conformances = [
            ...jsonConformance,
            ...extensionConformances.value.filter(
                (extension) =>
                    !jsonConformance.some(
                        (json) =>
                            json.interface.name === extension.interface.name &&
                            json.interface.namespace ===
                                extension.interface.namespace,
                    ),
            ),
        ]
        context.scope.rootScope.emitted.push({
            kind: 'RC_TYPE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            ...(conformances.length > 0 && {
                conformances,
            }),
            ...((serializerMethod || extensionMethods.value.length > 0) && {
                methods: [
                    ...(serializerMethod ? [serializerMethod] : []),
                    ...extensionMethods.value,
                ],
            }),
            properties: this.properties.map((property) => ({
                name: property.name,
                type: context.scope.toCIRType(property.type!),
            })),
        })
        return Result.ok
    }

    private checkExtensionConformances(
        context: Context,
        extensions: ExtensionDeclaration[],
        methods: (cir.Declaration & { kind: 'FUNCTION_DECL' })[],
    ): SemanticResult<
        NonNullable<
            Extract<cir.Declaration, { kind: 'RC_TYPE_DECL' }>['conformances']
        >
    > {
        type Conformance = NonNullable<
            Extract<cir.Declaration, { kind: 'RC_TYPE_DECL' }>['conformances']
        >[number]
        const conformances: Conformance[] = []
        const seen = new Set<string>()
        for (const extension of extensions) {
            if (!extension.conformance) continue
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
                conformances.push({
                    interface: inherited.name.toCIR(),
                    fulfillments,
                })
            }
        }
        return Result.value(conformances)
    }

    private isValidSerializer(context: Context): boolean {
        if (
            !this.serializer ||
            this.serializer.name().toString() !== 'toJSON()'
        )
            return false
        if (this.serializer.parameters.length !== 0 || !this.serializer.result)
            return false
        return (
            this.serializer.result.type instanceof StringSet &&
            this.serializer.result.isolationLevel !== 'SHARED' &&
            context.scope.interfaceDeclaration(
                TypeName.create({
                    name: 'JSONSerializable',
                    namespace: 'clawr',
                }),
            ) !== undefined
        )
    }

    private implicitlyJSONSerializable(
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
                    !!nested &&
                    nested.implicitlyJSONSerializable(context, visiting)
                )
            }
            return false
        })
        visiting.delete(this)
        return result
    }
}
