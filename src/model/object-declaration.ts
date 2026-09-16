import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, Result } from '@/tools/failable'
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
        const self = this
        return Failable.do(function* () {
            context.scope.rootScope.addObjectDeclaration(self)

            const objectContext = {
                ...context,
                scope: context.scope.createChildScope(),
                self: self.name,
            }
            objectContext.scope.addObjectDeclaration(self)
            objectContext.scope.variables.set('self', {
                isImmutable: false,
                isolationLevel: SHARED,
                lattice: RCTypeLattice.create({ type: self.name }),
            })
            objectContext.scope.setCurrentValue(
                'self',
                RCTypeLattice.create({ type: self.name }),
            )

            const methods: (cir.Declaration & { kind: 'FUNCTION_DECL' })[] =
                yield yield* Failable.map(
                    [...self.readonly, ...self.mutating],
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
                [...self.initializers],
                function* (item) {
                    return yield* item.emitInitializer(objectContext)
                },
            )

            context.scope.rootScope.emitted.push({
                kind: 'RC_TYPE_DECL',
                name: self.name.name,
                namespace: self.name.namespace,
                methods,
                initializers,
                fields: self.fields.map((field) => ({
                    name: field.name,
                    lattice: field.lattice!.toCIR(),
                })),
            })
            return Result.success
        })
    }
}
