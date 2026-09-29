export interface Position {
    line: number
    column: number
}

export type SourceCodeSpan = {
    start: Position
    end: Position
}

export interface ErrorReporter {
    reportFatalError(message: string, location: SourceCodeSpan): never
    reportWarning(message: string, location: SourceCodeSpan): void
    reportError(message: string, location: SourceCodeSpan): void
}
