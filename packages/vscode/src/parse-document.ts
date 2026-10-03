import { TokenStream } from '@clawr/frontend/lexer'
import { Scope } from '@clawr/frontend/model/scope'
import { ModuleParser } from '@clawr/frontend/parser'
import type {
    HighlightRecorder,
    SemanticTokenKind,
    SemanticTokenModifier,
    SourceCodeSpan,
} from '@clawr/frontend/tools'
import { SourceError, SourceErrorCollection } from '@clawr/frontend/tools'
import { CollectedDiagnostic } from './diagnostics'

export type RecordedHighlight = {
    kind: SemanticTokenKind
    span: SourceCodeSpan
    modifiers: SemanticTokenModifier[]
}

export type ParsedDocument = {
    diagnostics: CollectedDiagnostic[]
    highlights: RecordedHighlight[]
}

/**
 * Parses and (best-effort) lowers a Clawr source file, collecting diagnostics
 * and semantic highlight spans along the way. Never throws: parse/emission
 * failures are converted into diagnostics.
 */
export function parseDocument(source: string): ParsedDocument {
    const diagnostics: CollectedDiagnostic[] = []
    const highlights: RecordedHighlight[] = []
    const highlightRecorder: HighlightRecorder = {
        record(kind, span, modifiers) {
            highlights.push({ kind, span, modifiers: modifiers ?? [] })
        },
    }
    const context = {
        highlightRecorder,
        scope: Scope.createRoot(),
    }

    try {
        const stream = TokenStream.read(source)
        const module = ModuleParser.create(context).parse(stream)
        module.toCIR(context)
    } catch (err) {
        if (err instanceof SourceErrorCollection) {
            for (const error of err.errors)
                diagnostics.push({
                    message: error.message,
                    span: error.span,
                    severity: 'error',
                })
        } else if (err instanceof SourceError) {
            diagnostics.push({
                message: err.message,
                span: err.span,
                severity: 'error',
            })
        }
    }

    return { diagnostics, highlights }
}
