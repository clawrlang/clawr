import { ErrorReporter, SourceCodeSpan } from '@/tools/diagnostics'
import { Context } from '@/model'
import { Scope } from '@/model/scope'

export class TestErrorReporter implements ErrorReporter {
    errors: { message: string; location: SourceCodeSpan }[] = []
    warnings: { message: string; location: SourceCodeSpan }[] = []

    reportFatalError(message: string, location: SourceCodeSpan): never {
        this.reportError(message, location)
        throw new Error(message)
    }
    reportWarning(message: string, location: SourceCodeSpan): void {
        this.warnings.push({ message, location })
    }
    reportError(message: string, location: SourceCodeSpan): void {
        this.errors.push({ message, location })
    }
}
export function newSemanticContext(): Context {
    return {
        scope: Scope.createRoot(),
    } as const
}
export const someCodeSpan = {
    start: { line: 0, column: 0 },
    end: { line: 0, column: 0 },
}
