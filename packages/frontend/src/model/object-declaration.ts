import { Context, Declaration } from '@/model'
import { Property } from '@/model/data-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { FunctionName } from '@/model/function-name'
import { TypeName } from '@/model/type-name'
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

export class ObjectDeclaration implements Declaration {
    private dispatchTable: DispatchSlot[] | undefined

    private constructor(
        private readonly kind: 'object' | 'service',
        public readonly name: TypeName,
        private readonly superType: string | undefined,
        private readonly readonly: FunctionDeclaration[],
        private readonly mutating: FunctionDeclaration[],
        private readonly initializers: FunctionDeclaration[],
        public readonly properties: Property[],
        private readonly span: SourceCodeSpan,
    ) {}

    static create({
        kind,
        name,
        superType,
        readonly,
        mutating,
        initializers,
        properties,
        span,
    }: {
        kind: 'object' | 'service'
        name: TypeName
        superType?: string
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

    private superTypeName(): TypeName | undefined {
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

        const initializersResult = SemanticResult.collect(
            this.initializers.map((m) => m.emitInitializer(objectContext)),
        )
        if (initializersResult.isError) return initializersResult
        const initializers = initializersResult.value

        const tableResult = this.makeDispatchTable(context, methods)
        if (tableResult.isError) return tableResult
        this.dispatchTable = tableResult.value

        context.scope.rootScope.emitted.push({
            kind: 'RC_TYPE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            ...(this.superType && { base: this.superTypeName()!.toCIR() }),
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

        const sameName = (
            a: { baseName: string; labels: string[] },
            b: { baseName: string; labels: string[] },
        ) =>
            a.baseName === b.baseName &&
            a.labels.length === b.labels.length &&
            a.labels.every((label, i) => label === b.labels[i])
        const sameSignature = (
            a: DispatchSlot['slot'],
            b: DispatchSlot['slot'],
        ) =>
            JSON.stringify([a.parameters.map((p) => p.type), a.returnType]) ===
            JSON.stringify([b.parameters.map((p) => p.type), b.returnType])

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
}
