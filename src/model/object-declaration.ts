import { SourceCodeSpan } from '../diagnostics'
import { FunctionDeclaration } from './function-declaration'
import { DataField } from './data-declaration'

export class ObjectDeclaration {
    private constructor(
        private name: string,
        private readonly: FunctionDeclaration[],
        private mutating: FunctionDeclaration[],
        private fields: DataField[],
        private span: SourceCodeSpan,
    ) {}

    static create({
        name,
        readonly,
        mutating,
        fields,
        span,
    }: {
        name: string
        readonly: FunctionDeclaration[]
        mutating: FunctionDeclaration[]
        fields: DataField[]
        span: SourceCodeSpan
    }) {
        return new ObjectDeclaration(name, readonly, mutating, fields, span)
    }
}
