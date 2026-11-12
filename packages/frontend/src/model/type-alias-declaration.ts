import { Context, Declaration } from '@/model'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { Result } from '@/tools/result'
import { SemanticResult } from '@/tools/source-result'
import { SourceCodeSpan } from '@/tools/diagnostics'

export class TypeAliasDeclaration implements Declaration {
    private constructor(
        public readonly name: string,
        public readonly value: TypeConstraintDeclaration,
        public readonly nameSpan?: SourceCodeSpan,
    ) {}

    static create({
        name,
        value,
        nameSpan,
    }: {
        name: string
        value: TypeConstraintDeclaration
        nameSpan?: SourceCodeSpan
    }) {
        return new TypeAliasDeclaration(name, value, nameSpan)
    }

    emitDeclaration(_context: Context): SemanticResult {
        return Result.ok
    }
}
