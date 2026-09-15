import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { FunctionDeclaration } from './function-declaration'
import { DataField } from './data-declaration'
import { Context, Declaration } from '.'
import { Failable } from '@/tools/failable'
import { TypeName } from './type-name'
import { RCTypeLattice } from './lattice'
import { SHARED } from './isolation-level'

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

    *emitDeclaration(context: Context): Failable {
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

        const methods: (cir.Declaration & { kind: 'FUNCTION_DECL' })[] =
            yield yield* Failable.map(
                [...this.readonly, ...this.mutating],
                function* (item) {
                    const methodCIRResult =
                        yield* item.emitMethod(objectContext)
                    return methodCIRResult
                },
            )

        const initializers: (cir.Declaration & {
            kind: 'FUNCTION_DECL'
            lattice: undefined
        })[] = yield yield* Failable.map(
            [...this.initializers],
            function* (item) {
                return yield* item.emitInitializer(objectContext)
            },
        )

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
        return Failable.success()
    }
}
