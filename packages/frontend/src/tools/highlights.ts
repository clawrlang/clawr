import { SourceCodeSpan } from '@/tools/diagnostics'

export type SemanticTokenKind =
    'variable' | 'parameter' | 'property' | 'type' | 'function'

export type SemanticTokenModifier = 'declaration' | 'readonly' | 'shared'

export interface HighlightRecorder {
    record(
        kind: SemanticTokenKind,
        span: SourceCodeSpan,
        modifiers?: SemanticTokenModifier[],
    ): void
}
