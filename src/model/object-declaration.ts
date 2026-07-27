import { SourceCodeSpan } from '../diagnostics'
import { FunctionDeclaration } from './function-declaration'
import { DataField } from './data-declaration'

export class ObjectDeclaration {
    private constructor(
        private kind: 'object' | 'service',
        private name: string,
        private readonly: FunctionDeclaration[],
        private mutating: FunctionDeclaration[],
        private inheritance: FunctionDeclaration[],
        private fields: DataField[],
        private span: SourceCodeSpan,
    ) {}

    static create({
        kind,
        name,
        readonly,
        mutating,
        inheritance,
        fields,
        span,
    }: {
        kind: 'object' | 'service'
        name: string
        readonly: FunctionDeclaration[]
        mutating: FunctionDeclaration[]
        inheritance: FunctionDeclaration[]
        fields: DataField[]
        span: SourceCodeSpan
    }) {
        return new ObjectDeclaration(
            kind,
            name,
            readonly,
            mutating,
            inheritance,
            fields,
            span,
        )
    }
}
