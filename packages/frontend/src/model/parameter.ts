import { Expression } from '@/model'
import { IsolationLevel, UNKNOWN } from '@/model/isolation-level'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { SourceCodeSpan } from '@/tools/diagnostics'

export class Parameter {
    private constructor(
        public readonly isImmutable: boolean,
        public readonly label: string | undefined,
        public readonly varName: string,
        public readonly span: SourceCodeSpan,
        public readonly isolationLevel: IsolationLevel | UNKNOWN,
        public readonly type: TypeConstraintDeclaration | undefined,
        public readonly defaultValue?: Expression,
    ) {}

    static create({
        isImmutable,
        label,
        varName,
        isolationLevel,
        type,
        defaultValue,
        span,
    }: {
        label: string | undefined
        varName: string
        isolationLevel: IsolationLevel | UNKNOWN
        type?: TypeConstraintDeclaration
        isImmutable: boolean
        defaultValue?: Expression
        span: SourceCodeSpan
    }): Parameter {
        return new Parameter(
            isImmutable,
            label,
            varName,
            span,
            isolationLevel,
            type,
            defaultValue,
        )
    }
}
