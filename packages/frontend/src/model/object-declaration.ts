import { Context, Declaration } from '@/model'
import { Property } from '@/model/data-declaration'
import type { ExtensionDeclaration } from '@/model/extension-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { FunctionName } from '@/model/function-name'
import {
    InterfaceDeclaration,
    MethodSignature,
} from '@/model/interface-declaration'
import { TypeName } from '@/model/type-name'
import { RCTypeSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

type DispatchSlot = NonNullable<
    Extract<cir.Declaration, { kind: 'RC_TYPE_DECL' }> extends infer D
        ? D extends { dispatchTable?: infer T }
            ? T
            : never
        : never
>[number]

type Conformance = NonNullable<
    Extract<cir.Declaration, { kind: 'RC_TYPE_DECL' }>['conformances']
>[number]

type MethodCIR = cir.Declaration & { kind: 'FUNCTION_DECL' }

const sameName = (
    a: { baseName: string; labels: string[] },
    b: { baseName: string; labels: string[] },
) =>
    a.baseName === b.baseName &&
    a.labels.length === b.labels.length &&
    a.labels.every((label, i) => label === b.labels[i])

const canonicalName = ({ name, namespace }: cir.CanonicalName) =>
    namespace ? `${namespace}¸${name}` : name

const sameSignature = (
    a: { parameters: { type: unknown }[]; returnType: unknown },
    b: { parameters: { type: unknown }[]; returnType: unknown },
) =>
    JSON.stringify([a.parameters.map((p) => p.type), a.returnType]) ===
    JSON.stringify([b.parameters.map((p) => p.type), b.returnType])

export class ObjectDeclaration implements Declaration {
    private dispatchTable: DispatchSlot[] | undefined
    private emittedMethods: MethodCIR[] = []
    private superType: string | undefined
    private conformances: string[]
    private readonly inherits: string[]

    private constructor(
        private readonly kind: 'object' | 'service',
        public readonly name: TypeName,
        superType: string | undefined,
        conformances: string[],
        inherits: string[],
        private readonly readonly: FunctionDeclaration[],
        private readonly mutating: FunctionDeclaration[],
        private readonly initializers: FunctionDeclaration[],
        public readonly properties: Property[],
        public readonly span: SourceCodeSpan,
        public readonly nameSpan?: SourceCodeSpan,
        public readonly opaque = false,
    ) {
        this.superType = superType
        this.conformances = conformances
        this.inherits = inherits
    }

    static create({
        kind,
        name,
        superType,
        conformances,
        inherits,
        readonly,
        mutating,
        initializers,
        properties,
        span,
        nameSpan,
        opaque,
    }: {
        kind: 'object' | 'service'
        name: TypeName
        superType?: string
        conformances?: string[]
        /** Unresolved names after `:`; the first may be a supertype. */
        inherits?: string[]
        readonly: FunctionDeclaration[]
        mutating: FunctionDeclaration[]
        initializers: FunctionDeclaration[]
        properties: Property[]
        span: SourceCodeSpan
        nameSpan?: SourceCodeSpan
        opaque?: boolean
    }) {
        return new ObjectDeclaration(
            kind,
            name,
            superType,
            conformances ?? [],
            inherits ?? [],
            readonly,
            mutating,
            initializers,
            properties,
            span,
            nameSpan,
            opaque,
        )
    }

    method(name: FunctionName): FunctionDeclaration | undefined {
        return [...this.readonly, ...this.mutating].find(
            (m) => m.name().toString() === name.toString(),
        )
    }

    isService(): boolean {
        return this.kind === 'service'
    }

    initializer(name: FunctionName): FunctionDeclaration | undefined {
        return this.initializers.find(
            (initializer) => initializer.name().toString() === name.toString(),
        )
    }

    superTypeName(): TypeName | undefined {
        return this.superType
            ? TypeName.create({
                  name: this.superType,
                  namespace: this.name.namespace,
              })
            : undefined
    }

    private superDeclaration(context: Context): ObjectDeclaration | undefined {
        const name = this.superTypeName()
        return name && context.scope.objectDeclaration(name)
    }

    isSubtypeOf(
        name: TypeName,
        context: Context,
        visiting = new Set<string>(),
    ): boolean {
        if (visiting.has(this.name.canonical())) return false
        visiting.add(this.name.canonical())
        return (
            this.name.canonical() === name.canonical() ||
            !!this.superDeclaration(context)?.isSubtypeOf(
                name,
                context,
                visiting,
            )
        )
    }

    /** Subtypes and types with subtypes dispatch their methods dynamically. */
    isPolymorphic(context: Context): boolean {
        return !!this.superType || context.scope.isBase(this.name)
    }

    /** Finds a method declared by this type or inherited from a supertype. */
    lookupMethod(
        name: FunctionName,
        context: Context,
    ):
        | {
              declaration: FunctionDeclaration
              owner: ObjectDeclaration
              isExtension: boolean
          }
        | undefined {
        const own = this.method(name)
        if (own) return { declaration: own, owner: this, isExtension: false }
        const extension = this.extensionMethod(name, context)
        if (extension)
            return { declaration: extension, owner: this, isExtension: true }
        return this.superDeclaration(context)?.lookupMethod(name, context)
    }

    extensionMethod(
        name: FunctionName,
        context: Context,
    ): FunctionDeclaration | undefined {
        return context.scope
            .extensionDeclarations(this.name)
            .flatMap((extension: ExtensionDeclaration) => [
                ...extension.methods,
                ...extension.mutating,
            ])
            .find((method) => method.name().toString() === name.toString())
    }

    isMutatingMethod(name: FunctionName, context: Context): boolean {
        return (
            this.mutating.some(
                (method) => method.name().toString() === name.toString(),
            ) ||
            context.scope
                .extensionDeclarations(this.name)
                .some((extension) =>
                    extension.mutating.some(
                        (method) =>
                            method.name().toString() === name.toString(),
                    ),
                ) ||
            !!this.superDeclaration(context)?.isMutatingMethod(name, context)
        )
    }

    isExtensionMutatingMethod(name: FunctionName, context: Context): boolean {
        return (
            context.scope
                .extensionDeclarations(this.name)
                .some((extension) =>
                    extension.mutating.some(
                        (method) =>
                            method.name().toString() === name.toString(),
                    ),
                ) ||
            !!this.superDeclaration(context)?.isExtensionMutatingMethod(
                name,
                context,
            )
        )
    }

    registerDeclaration(context: Context) {
        if (this.inherits.length) {
            const [first, ...rest] = this.inherits
            const isInterface = (name: string) =>
                !!context.scope.interfaceDeclaration(
                    TypeName.create({
                        name,
                        namespace: this.name.namespace,
                    }),
                )
            if (isInterface(first)) {
                this.superType = undefined
                this.conformances = this.inherits
            } else {
                this.superType = first
                this.conformances = rest
            }
        }
        const superName = this.superTypeName()
        if (superName) context.scope.markAsBase(superName)
        context.scope.rootScope.addObjectDeclaration(this)
    }

    injectSelf(context: Context): Context {
        const scope = context.scope.createChildScope()
        scope.addSelfVariable(this.name)
        return { ...context, scope }
    }

    emitDeclaration(context: Context): SemanticResult {
        context.scope.rootScope.addObjectDeclaration(this)
        if (this.opaque && context.scope.namespace !== 'clawr')
            return SemanticErrorResult.failure(
                'Unsupported opaque service declaration',
                this.span,
            )

        if (this.superDeclaration(context)?.opaque)
            return SemanticErrorResult.failure(
                'Opaque services cannot be subclassed',
                this.span,
            )

        const objectContext = {
            ...context,
            scope: context.scope.createChildScope(),
        }
        objectContext.scope.addObjectDeclaration(this)
        objectContext.scope.addSelfVariable(this.name)

        const declaredMethodsResult = SemanticResult.collect(
            (this.opaque ? [] : [...this.readonly, ...this.mutating]).map((m) =>
                m.emitMethod(objectContext),
            ),
        )
        if (declaredMethodsResult.isError) return declaredMethodsResult
        const extensions = context.scope.rootScope.extensionDeclarations(
            this.name,
        )
        const extensionMethods = new Map<
            ExtensionDeclaration,
            (cir.Declaration & { kind: 'FUNCTION_DECL' })[]
        >()
        for (const extension of extensions) {
            const methodsResult = SemanticResult.collect(
                [...extension.methods, ...extension.mutating].map((method) =>
                    method.emitMethod(objectContext),
                ),
            )
            if (methodsResult.isError) return methodsResult
            extensionMethods.set(extension, methodsResult.value)
        }
        this.emittedMethods = [
            ...declaredMethodsResult.value,
            ...[...extensionMethods.values()].flat(),
        ]

        const initializersResult = SemanticResult.collect(
            this.initializers.map((m) => m.emitInitializer(objectContext)),
        )
        if (initializersResult.isError) return initializersResult
        const initializers = initializersResult.value

        const conformancesResult = this.checkConformances(context)
        if (conformancesResult.isError) return conformancesResult
        if (!this.opaque) {
            const extensionConformanceNames =
                this.extensionConformanceNames(context)
            const conformances = conformancesResult.value.filter(
                (conformance) =>
                    !extensionConformanceNames.has(
                        canonicalName(conformance.interface),
                    ),
            )
            const tableResult = this.makeDispatchTable(
                context,
                declaredMethodsResult.value,
            )
            if (tableResult.isError) return tableResult
            this.dispatchTable = tableResult.value
            context.scope.rootScope.emitted.push({
                kind: 'RC_TYPE_DECL',
                name: this.name.name,
                namespace: this.name.namespace,
                ...(this.superType && { base: this.superTypeName()!.toCIR() }),
                ...(conformances.length && {
                    conformances,
                }),
                ...(this.dispatchTable && {
                    dispatchTable: this.dispatchTable,
                }),
                methods: declaredMethodsResult.value,
                initializers,
                properties: this.properties.map((property) => ({
                    name: property.name,
                    type: context.scope.toCIRType(property.type),
                })),
            })
        }
        for (const extension of extensions) {
            const interfaceDeclaration = extension.conformance
                ? context.scope.interfaceDeclaration(extension.conformance)
                : undefined
            const extensionInterfaces = new Set(
                interfaceDeclaration
                    ?.hierarchy(context)
                    .map((iface) => iface.name.canonical()) ?? [],
            )
            const extensionConformances = conformancesResult.value.filter(
                (conformance) =>
                    extensionInterfaces.has(
                        canonicalName(conformance.interface),
                    ),
            )
            context.scope.rootScope.emitted.push({
                kind: 'EXTENSION_DECL',
                target: this.name.toCIR(),
                methods: extensionMethods.get(extension) ?? [],
                ...(extensionConformances.length > 0 && {
                    conformances: extensionConformances,
                }),
            })
        }
        return Result.ok
    }

    private extensionConformanceNames(context: Context): Set<string> {
        const names =
            this.superDeclaration(context)?.extensionConformanceNames(
                context,
            ) ?? new Set<string>()
        for (const extension of context.scope.rootScope.extensionDeclarations(
            this.name,
        )) {
            if (!extension.conformance) continue
            const declaration = context.scope.interfaceDeclaration(
                extension.conformance,
            )
            for (const inherited of declaration?.hierarchy(context) ?? [])
                names.add(inherited.name.canonical())
        }
        return names
    }

    private makeDispatchTable(
        context: Context,
        methods: (cir.Declaration & { kind: 'FUNCTION_DECL' })[],
    ): SemanticResult<DispatchSlot[] | undefined> {
        if (!this.isPolymorphic(context)) return Result.value(undefined)

        let inherited: DispatchSlot[] = []
        if (this.superType) {
            const superDecl = this.superDeclaration(context)
            if (!superDecl?.dispatchTable)
                return SemanticErrorResult.failure(
                    `Supertype ${this.superType} must be an object declared before ${this.name.name}`,
                    this.span,
                )
            inherited = superDecl.dispatchTable
        }

        const self = this.name.toCIR()
        const slots: DispatchSlot[] = []
        for (const entry of inherited) {
            const override = methods.find((m) => sameName(m, entry.slot))
            if (!override) {
                slots.push(entry)
            } else if (!sameSignature(override, entry.slot)) {
                return SemanticErrorResult.failure(
                    `Method ${this.name.name}.${override.baseName} must have the same signature as the method it overrides`,
                    this.span,
                )
            } else {
                slots.push({ ...entry, implementation: self })
            }
        }
        for (const method of methods)
            if (!inherited.some((entry) => sameName(method, entry.slot)))
                slots.push({
                    slot: {
                        baseName: method.baseName,
                        labels: method.labels,
                        parameters: method.parameters,
                        returnType: method.returnType,
                    },
                    declaredIn: self,
                    implementation: self,
                })
        return Result.value(slots)
    }

    /** Finds an emitted method declared by this type or a supertype. */
    private findEmittedMethod(
        name: { baseName: string; labels: string[] },
        context: Context,
    ): MethodCIR | undefined {
        return (
            this.emittedMethods.find((m) => sameName(m, name)) ??
            this.superDeclaration(context)?.findEmittedMethod(name, context)
        )
    }

    /** Parameters must match exactly; the result may be narrower. */
    private fulfills(
        required: MethodSignature,
        requirement: { parameters: { type: unknown }[] },
        implementation: MethodCIR,
        context: Context,
        selfType: TypeName,
    ): SemanticResult<boolean> {
        const sameParameters =
            JSON.stringify(implementation.parameters.map((p) => p.type)) ===
            JSON.stringify(requirement.parameters.map((p) => p.type))
        if (!sameParameters) return Result.value(false)
        if (!required.result)
            return Result.value(implementation.returnType.universe === 'void')

        const found = this.lookupMethod(required.name(), context)
        if (!found) return Result.value(false)
        const type = found.declaration.type(found.owner.injectSelf(context))
        if (type.isError) return type
        const expected =
            required.result instanceof RCTypeSet &&
            required.result.type.name === 'Self'
                ? RCTypeSet.create({ type: selfType })
                : required.result
        return Result.value(!!type.value && expected.isSupersetTo(type.value))
    }

    /** Own conformances followed by those inherited from supertypes. */
    private allConformances(context: Context): string[] {
        const inherited =
            this.superDeclaration(context)?.allConformances(context) ?? []
        const extensions = context.scope
            .extensionDeclarations(this.name)
            .flatMap((extension) =>
                extension.conformance ? [extension.conformance.name] : [],
            )
        return [
            ...this.conformances,
            ...extensions,
            ...inherited.filter((name) => !this.conformances.includes(name)),
        ]
    }

    private conformanceSelf(name: string, context: Context): TypeName {
        return this.conformances.includes(name) ||
            context.scope
                .extensionDeclarations(this.name)
                .some((extension) => extension.conformance?.name === name)
            ? this.name
            : (this.superDeclaration(context)?.conformanceSelf(name, context) ??
                  this.name)
    }

    conformsTo(name: TypeName, context: Context): boolean {
        const target = context.scope.interfaceDeclaration(name)
        return (
            !!target &&
            this.allConformances(context).some((conformance) =>
                context.scope
                    .interfaceDeclaration(
                        TypeName.create({
                            name: conformance,
                            namespace: this.name.namespace,
                        }),
                    )
                    ?.hierarchy(context)
                    .includes(target),
            )
        )
    }

    private checkConformances(context: Context): SemanticResult<Conformance[]> {
        const result: Conformance[] = []
        const seen = new Set<string>()
        const declarations = new Map<InterfaceDeclaration, TypeName>()
        for (const name of this.allConformances(context)) {
            const typeName = TypeName.create({
                name,
                namespace: this.name.namespace,
            })
            const interfaceDecl = context.scope.interfaceDeclaration(typeName)
            if (!interfaceDecl)
                return SemanticErrorResult.failure(
                    `${name} is not a trait or role`,
                    this.span,
                )
            if (seen.has(name))
                return SemanticErrorResult.failure(
                    `${this.name.name} conforms to ${name} more than once`,
                    this.span,
                )
            seen.add(name)
            if (interfaceDecl.kind === 'trait' && this.kind === 'service')
                return SemanticErrorResult.failure(
                    `Service ${this.name.name} cannot conform to trait ${name}; use a role`,
                    this.span,
                )

            const selfType = this.conformanceSelf(name, context)
            for (const inherited of interfaceDecl.hierarchy(context))
                if (!declarations.has(inherited))
                    declarations.set(inherited, selfType)
        }
        for (const [interfaceDecl, selfType] of declarations) {
            const name = interfaceDecl.name.name
            const fulfillments: Conformance['fulfillments'] = []
            for (const method of interfaceDecl.resolvedMethods(context)) {
                const requirementResult = method.toCIR(context, selfType)
                if (requirementResult.isError) return requirementResult
                const requirement = requirementResult.value
                const implementation = this.findEmittedMethod(
                    requirement,
                    context,
                )
                if (!implementation)
                    return SemanticErrorResult.failure(
                        `${this.name.name} does not implement ${name}.${requirement.baseName}`,
                        this.span,
                    )
                if (this.isExtensionMutatingMethod(method.name(), context))
                    return SemanticErrorResult.failure(
                        `Mutating method ${requirement.baseName} cannot implement a trait or role requirement`,
                        this.span,
                    )
                const compatible = this.fulfills(
                    method,
                    requirement,
                    implementation,
                    context,
                    selfType,
                )
                if (compatible.isError) return compatible
                if (!compatible.value)
                    return SemanticErrorResult.failure(
                        `${this.name.name}.${requirement.baseName} must have the same signature as the requirement in ${name}`,
                        this.span,
                    )
                fulfillments.push({
                    requirement: {
                        baseName: requirement.baseName,
                        labels: requirement.labels,
                    },
                    implementation: {
                        baseName: implementation.baseName,
                        labels: implementation.labels,
                    },
                })
            }
            result.push({ interface: interfaceDecl.name.toCIR(), fulfillments })
        }
        return Result.value(result)
    }
}
