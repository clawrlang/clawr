import { Expression } from '@/model'
import { DomainDeclaration } from '@/model/domain-declaration'
import { IsolationLevel, UNKNOWN } from '@/model/isolation-level'
import { SourceCodeSpan } from '@/tools/diagnostics'

export class Parameter {
    private constructor(
        public readonly isImmutable: boolean,
        public readonly label: string | undefined,
        public readonly varName: string,
        public readonly span: SourceCodeSpan,
        public readonly isolationLevel: IsolationLevel | UNKNOWN,
        public readonly domain: DomainDeclaration | undefined,
        public readonly defaultValue?: Expression,
    ) {}

    static create({
        isImmutable,
        label,
        varName,
        isolationLevel,
        domain,
        defaultValue,
        span,
    }: {
        label: string | undefined
        varName: string
        isolationLevel: IsolationLevel | UNKNOWN
        domain?: DomainDeclaration
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
            domain,
            defaultValue,
        )
    }
}
