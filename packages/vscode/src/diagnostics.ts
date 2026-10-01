import type { ErrorReporter, SourceCodeSpan } from '@clawr/frontend/tools'

export type DiagnosticSeverity = 'error' | 'warning'

export type CollectedDiagnostic = {
    message: string
    span: SourceCodeSpan
    severity: DiagnosticSeverity
}

/**
 * Collects diagnostics instead of throwing/logging, so a whole parse attempt's
 * errors can be surfaced to the editor.
 *
 * `reportFatalError` is also used by the parser for speculative/backtracking
 * sub-parses (e.g. trying an argument label, then abandoning it) whose
 * exceptions are caught and discarded internally by the parser. Those calls
 * still reach this reporter, so fatal reports are buffered separately in
 * `fatalCandidates` rather than trusted immediately — only the caller (which
 * knows whether the overall parse ultimately threw) can tell which one, if
 * any, was the real syntax error.
 */
export class CollectingErrorReporter implements ErrorReporter {
    readonly diagnostics: CollectedDiagnostic[] = []
    readonly fatalCandidates: CollectedDiagnostic[] = []

    reportFatalError(message: string, span: SourceCodeSpan): never {
        this.fatalCandidates.push({ message, span, severity: 'error' })
        throw new Error(message)
    }

    reportWarning(message: string, span: SourceCodeSpan): void {
        this.diagnostics.push({ message, span, severity: 'warning' })
    }

    reportError(message: string, span: SourceCodeSpan): void {
        this.diagnostics.push({ message, span, severity: 'error' })
    }
}
