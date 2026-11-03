import { Context, Declaration } from '@/model'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { Result } from '@/tools/result'
import { SemanticResult } from '@/tools/source-result'

export class TypeAliasDeclaration implements Declaration {
    private constructor(
        public readonly name: string,
        public readonly value: TypeConstraintDeclaration,
    ) {}

    static create({
        name,
        value,
    }: {
        name: string
        value: TypeConstraintDeclaration
    }) {
        return new TypeAliasDeclaration(name, value)
    }

    emitDeclaration(_context: Context): SemanticResult {
        return Result.ok
    }
}
