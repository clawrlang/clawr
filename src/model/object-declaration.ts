import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticResult } from '@/tools/semantic-result'
import { Context, Declaration } from '.'
import { DataField } from './data-declaration'
import { FunctionDeclaration } from './function-declaration'
import { TypeName } from './type-name'

export class ObjectDeclaration implements Declaration {
    private constructor(
        private readonly kind: 'object' | 'service',
        public readonly name: TypeName,
        private readonly superType: string | undefined,
        private readonly readonly: FunctionDeclaration[],
        private readonly mutating: FunctionDeclaration[],
        private readonly initializers: FunctionDeclaration[],
        public readonly fields: DataField[],
        private readonly span: SourceCodeSpan,
    ) {}

    static create({
        kind,
        name,
        superType,
        readonly,
        mutating,
        initializers,
        fields,
        span,
    }: {
        kind: 'object' | 'service'
        name: TypeName
        superType?: string
        readonly: FunctionDeclaration[]
        mutating: FunctionDeclaration[]
        initializers: FunctionDeclaration[]
        fields: DataField[]
        span: SourceCodeSpan
    }) {
        return new ObjectDeclaration(
            kind,
            name,
            superType,
            readonly,
            mutating,
            initializers,
            fields,
            span,
        )
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
            fields: this.fields.map((field) => ({
                name: field.name,
                lattice: field.lattice!.toCIR(),
            })),
        })
        return Result.ok
    }
}
