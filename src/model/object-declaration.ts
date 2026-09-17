import { SourceCodeSpan } from '@/tools/diagnostics'
import { isFailure, Result } from '@/tools/result'
import { Context, Declaration } from '.'
import { DataField } from './data-declaration'
import { FunctionDeclaration } from './function-declaration'
import { SHARED } from './isolation-level'
import { RCTypeLattice } from './lattice'
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

    emitDeclaration(context: Context): Result {
        context.scope.rootScope.addObjectDeclaration(this)

        const objectContext = {
            ...context,
            scope: context.scope.createChildScope(),
            self: this.name,
        }
        objectContext.scope.addObjectDeclaration(this)
        objectContext.scope.variables.set('self', {
            isImmutable: false,
            isolationLevel: SHARED,
            lattice: RCTypeLattice.create({ type: this.name }),
        })
        objectContext.scope.setCurrentValue(
            'self',
            RCTypeLattice.create({ type: this.name }),
        )

        const methodsResult = Result.collect(
            [...this.readonly, ...this.mutating].map((m) =>
                m.emitMethod(objectContext),
            ),
        )
        if (isFailure(methodsResult)) return methodsResult
        const methods = methodsResult.value

        const initializersResult = Result.collect(
            this.initializers.map((m) => m.emitInitializer(objectContext)),
        )
        if (isFailure(initializersResult)) return initializersResult
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
        return Result.success
    }
}
