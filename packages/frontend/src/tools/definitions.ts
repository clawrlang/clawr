import { SourceCodeSpan } from '@/tools/diagnostics'

export interface DefinitionRecorder {
    typeReference(name: string, span: SourceCodeSpan): void
    functionReference(span: SourceCodeSpan, definition: SourceCodeSpan): void
}
