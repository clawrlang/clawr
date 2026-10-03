import type { SourceCodeSpan } from '@clawr/frontend/tools'

export type DiagnosticSeverity = 'error' | 'warning'

export type CollectedDiagnostic = {
    message: string
    span: SourceCodeSpan
    severity: DiagnosticSeverity
}
