import { Context, Declaration } from '@/model'
import { Property } from '@/model/data-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { FunctionName } from '@/model/function-name'
import { TypeName } from '@/model/type-name'
import { MethodSignature } from '@/model/interface-declaration'
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
        private readonly span: SourceCodeSpan,
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
        )
    }

    method(name: FunctionName): FunctionDeclaration | undefined {
        return [...this.readonly, ...this.mutating].find(
            (m) => m.name().toString() === name.toString(),
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

    /** Subtypes and types with subtypes dispatch their methods dynamically. */
    isPolymorphic(context: Context): boolean {
        return !!this.superType || context.scope.isBase(this.name)
    }

    /** Finds a method declared by this type or inherited from a supertype. */
    lookupMethod(
        name: FunctionName,
        context: Context,
    ):
        | { declaration: FunctionDeclaration; owner: ObjectDeclaration }
        | undefined {
        const own = this.method(name)
        if (own) return { declaration: own, owner: this }
        return this.superDeclaration(context)?.lookupMethod(name, context)
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
    }

    injectSelf(context: Context): Context {
        const scope = context.scope.createChildScope()
        scope.addSelfVariable(this.name)
        return { ...context, scope }
    }

    emitDeclaration(context: Context): SemanticResult {
        context.scope.rootScope.addObjectDeclaration(this)

        const objectContext = {
            ...context,
            scope: context.scope.createChildScope(),
        }
        objectContext.scope.addObjectDeclaration(this)
        objectContext.scope.addSelfVariable(this.name)

        const methodsResult = SemanticResult.collect(
            [...this.readonly, ...this.mutating].map((m) =>
                m.emitMethod(objectContext),
            ),
        )
        if (methodsResult.isError) return methodsResult
        const methods = methodsResult.value
        this.emittedMethods = methods

        const initializersResult = SemanticResult.collect(
            this.initializers.map((m) => m.emitInitializer(objectContext)),
        )
        if (initializersResult.isError) return initializersResult
        const initializers = initializersResult.value

        const conformancesResult = this.checkConformances(context)
        if (conformancesResult.isError) return conformancesResult

        const tableResult = this.makeDispatchTable(context, methods)
        if (tableResult.isError) return tableResult
        this.dispatchTable = tableResult.value

        context.scope.rootScope.emitted.push({
            kind: 'RC_TYPE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            ...(this.superType && { base: this.superTypeName()!.toCIR() }),
            ...(conformancesResult.value.length && {
                conformances: conformancesResult.value,
            }),
            ...(this.dispatchTable && { dispatchTable: this.dispatchTable }),
            methods,
            initializers,
            properties: this.properties.map((property) => ({
                name: property.name,
                type: property.type.toCIR(),
            })),
        })
        return Result.ok
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
        return Result.value(
            !!type.value && required.result.isSupersetTo(type.value),
        )
    }

    private checkConformances(context: Context): SemanticResult<Conformance[]> {
        const result: Conformance[] = []
        const seen = new Set<string>()
        for (const name of this.conformances) {
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

            const fulfillments: Conformance['fulfillments'] = []
            for (const method of interfaceDecl.methods) {
                const requirementResult = method.toCIR()
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
                const compatible = this.fulfills(
                    method,
                    requirement,
                    implementation,
                    context,
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
            result.push({ interface: typeName.toCIR(), fulfillments })
        }
        return Result.value(result)
    }
}
