import { Context, Declaration } from '@/model'
import { Property } from '@/model/data-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { FunctionName } from '@/model/function-name'
import { TypeName } from '@/model/type-name'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticResult } from '@/tools/source-result'

export class ObjectDeclaration implements Declaration {
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

        context.scope.rootScope.emitted.push({
            kind: 'RC_TYPE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            methods,
            initializers,
            properties: this.properties.map((property) => ({
                name: property.name,
                domain: property.domain!.toCIR(),
            })),
        })
        return Result.ok
    }
}
