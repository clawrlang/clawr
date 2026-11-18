import { Expression } from '@/model'
import { IsolationLevel, UNKNOWN } from '@/model/isolation-level'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { HighlightRecorder } from '@/tools/highlights'

export class Parameter {
    private constructor(
        public readonly isImmutable: boolean,
        public readonly label: string | undefined,
        public readonly varName: string,
        public readonly span: SourceCodeSpan,
        public readonly isolationLevel: IsolationLevel | UNKNOWN,
        public readonly type: TypeConstraintDeclaration | undefined,
        public readonly defaultValue?: Expression,
        public readonly nameSpan?: SourceCodeSpan,
    ) {}

    static create({
        isImmutable,
        label,
        varName,
        isolationLevel,
        type,
        defaultValue,
        span,
        nameSpan,
    }: {
        label: string | undefined
        varName: string
        isolationLevel: IsolationLevel | UNKNOWN
        type?: TypeConstraintDeclaration
        isImmutable: boolean
        defaultValue?: Expression
        span: SourceCodeSpan
        nameSpan?: SourceCodeSpan
    }): Parameter {
        return new Parameter(
            isImmutable,
            label,
            varName,
            span,
            isolationLevel,
            type,
            defaultValue,
            nameSpan,
        )
    }
}

/** Records the semantic token for a parameter declaration's name. */
export function recordParameterDeclarationHighlight(
    recorder: HighlightRecorder | undefined,
    parameter: Pick<Parameter, 'isImmutable' | 'span' | 'nameSpan'>,
): void {
    recorder?.record('parameter', parameter.nameSpan ?? parameter.span, [
        'declaration',
        ...(parameter.isImmutable ? (['readonly'] as const) : []),
    ])
}
