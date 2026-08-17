import { Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { ExplicitValueSet } from './explicit-value-set'
import { IsolationLevel, UNKNOWN } from './isolation-level'

export class Parameter {
    private constructor(
        public isImmutable: boolean,
        public label: string | undefined,
        public varName: string,
        public span: SourceCodeSpan,
        public valueSet: ExplicitValueSet & {
            isolationLevel: IsolationLevel | UNKNOWN
        },
        public defaultValue?: Expression,
    ) {}

    static create({
        isImmutable,
        label,
        varName,
        valueSet,
        defaultValue,
        span,
    }: {
        label: string | undefined
        varName: string
        valueSet: ExplicitValueSet & {
            isolationLevel: IsolationLevel | UNKNOWN
        }
        isImmutable: boolean
        defaultValue?: Expression
        span: SourceCodeSpan
    }): Parameter {
        return new Parameter(
            isImmutable,
            label,
            varName,
            span,
            valueSet,
            defaultValue,
        )
    }
}
