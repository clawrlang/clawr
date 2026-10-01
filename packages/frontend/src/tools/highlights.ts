import { SourceCodeSpan } from './diagnostics'

export type SemanticTokenKind =
    'variable' | 'parameter' | 'field' | 'type' | 'function'

export type SemanticTokenModifier = 'declaration' | 'readonly' | 'shared'

export interface HighlightRecorder {
    record(
        kind: SemanticTokenKind,
        span: SourceCodeSpan,
        modifiers?: SemanticTokenModifier[],
    ): void
}
