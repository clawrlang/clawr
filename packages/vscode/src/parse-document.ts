import { TokenStream } from '@clawr/frontend/lexer'
import { Scope } from '@clawr/frontend/model/scope'
import { ModuleParser } from '@clawr/frontend/parser'
import type {
    HighlightRecorder,
    SemanticTokenKind,
    SemanticTokenModifier,
    SourceCodeSpan,
} from '@clawr/frontend/tools'
import { SemanticErrorCollection } from '@clawr/frontend/tools'
import { CollectedDiagnostic, CollectingErrorReporter } from './diagnostics'

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
    const errorReporter = new CollectingErrorReporter()
    const highlights: RecordedHighlight[] = []
    const highlightRecorder: HighlightRecorder = {
        record(kind, span, modifiers) {
            highlights.push({ kind, span, modifiers: modifiers ?? [] })
        },
    }
    const context = {
        errorReporter,
        highlightRecorder,
        scope: Scope.createRoot(),
    }

    try {
        const stream = TokenStream.read(source, errorReporter)
        const module = ModuleParser.create(context).parse(stream)
        module.toCIR(context)
    } catch (err) {
        if (err instanceof SemanticErrorCollection) {
            for (const error of err.errors)
                errorReporter.diagnostics.push({
                    message: error.message,
                    span: error.span,
                    severity: 'error',
                })
        } else {
            // A genuine syntax error unwound all the way here. Earlier fatal
            // candidates (if any) came from discarded speculative parses; only
            // the last one recorded corresponds to the error that actually
            // escaped.
            const syntaxError = errorReporter.fatalCandidates.at(-1)
            if (syntaxError) errorReporter.diagnostics.push(syntaxError)
        }
    }

    return { diagnostics: errorReporter.diagnostics, highlights }
}
