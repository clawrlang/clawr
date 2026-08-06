import { SourceCodeSpan } from '../diagnostics'
import { FunctionDeclaration } from './function-declaration'
import { DataField } from './data-declaration'
import { Context, Declaration } from '.'

export class ObjectDeclaration implements Declaration {
    private constructor(
        private kind: 'object' | 'service',
        private name: string,
        private superType: string | undefined,
        private readonly: FunctionDeclaration[],
        private mutating: FunctionDeclaration[],
        private inheritance: FunctionDeclaration[],
        private fields: DataField[],
        private span: SourceCodeSpan,
    ) {}

    static create({
        kind,
        name,
        superType,
        readonly,
        mutating,
        inheritance,
        fields,
        span,
    }: {
        kind: 'object' | 'service'
        name: string
        superType?: string
        readonly: FunctionDeclaration[]
        mutating: FunctionDeclaration[]
        inheritance: FunctionDeclaration[]
        fields: DataField[]
        span: SourceCodeSpan
    }) {
        return new ObjectDeclaration(
            kind,
            name,
            superType,
            readonly,
            mutating,
            inheritance,
            fields,
            span,
        )
    }

    emitDeclaration(context: Context) {}
}
