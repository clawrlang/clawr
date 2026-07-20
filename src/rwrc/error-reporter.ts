import { ErrorReporter, SourceCodeSpan } from '../diagnostics'
import { SemanticError } from '../model'

export class RWRCErrorReporter implements ErrorReporter {
    constructor(private file: string) {}

    reportFatalError(message: string, location: SourceCodeSpan): never {
        throw new Error(
            `Fatal Error: ${this.formatLocation(location)}:${message}`,
        )
    }
    reportWarning(message: string, location: SourceCodeSpan) {
        console.warn(`Warning: ${this.formatLocation(location)}:${message}`)
    }
    reportError(message: string, location: SourceCodeSpan) {
        console.error(`Error: ${this.formatLocation(location)}:${message}`)
    }

    private formatLocation(location: SourceCodeSpan): string {
        return location.start.line === location.end.line
            ? `${this.file}:${location.start.line}:${location.start.column}-${location.end.column}`
            : `${this.file}:${location.start.line}:${location.start.column}-${location.end.line}:${location.end.column}`
    }
}
