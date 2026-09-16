import { SourceCodeSpan } from '@/tools/diagnostics'
import { Expression } from '.'
import { IsolationLevel, UNKNOWN } from './isolation-level'
import { LatticeDeclaration } from './lattice-declaration'

export class Parameter {
    private constructor(
        public readonly isImmutable: boolean,
        public readonly label: string | undefined,
        public readonly varName: string,
        public readonly span: SourceCodeSpan,
        public readonly isolationLevel: IsolationLevel | UNKNOWN,
        public readonly lattice: LatticeDeclaration | undefined,
        public readonly defaultValue?: Expression,
    ) {}

    static create({
        isImmutable,
        label,
        varName,
        isolationLevel,
        lattice,
        defaultValue,
        span,
    }: {
        label: string | undefined
        varName: string
        isolationLevel: IsolationLevel | UNKNOWN
        lattice?: LatticeDeclaration
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
            lattice,
            defaultValue,
        )
    }
}
