import { Declaration } from '.'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { VariableDeclaration } from './variable-declaration'

export class Companion {
    private constructor(
        private name: string,
        private fields: VariableDeclaration[],
        private methods: Declaration[],
        private span: SourceCodeSpan,
    ) {}
    static create({
        name,
        fields,
        methods,
        span,
    }: {
        name: string
        fields: VariableDeclaration[]
        methods: Declaration[]
        span: SourceCodeSpan
    }) {
        return new Companion(name, fields, methods, span)
    }
}
