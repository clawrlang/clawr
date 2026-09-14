import { SourceCodeSpan } from '@/tools/diagnostics'
import { FunctionDeclaration } from './function-declaration'
import { DataField } from './data-declaration'
import { Context, Declaration } from '.'
import { Failable } from '@/tools/failable'
import { TypeName } from './type-name'

export class ObjectDeclaration implements Declaration {
    private constructor(
        private readonly kind: 'object' | 'service',
        public readonly name: TypeName,
        private readonly superType: string | undefined,
        private readonly readonly: FunctionDeclaration[],
        private readonly mutating: FunctionDeclaration[],
        private readonly initializers: FunctionDeclaration[],
        private readonly fields: DataField[],
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
        return Failable.success()
    }
}
