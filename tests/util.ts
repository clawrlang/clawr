import { ErrorReporter, SourceCodeSpan } from '../src/diagnostics'

export class TestErrorReporter implements ErrorReporter {
    errors: { message: string; location: SourceCodeSpan }[] = []
    warnings: { message: string; location: SourceCodeSpan }[] = []

    constructor(private file: string) {}

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
export function newSemanticContext() {
    return {
        scope: {
            declarations: new Map(),
            variableTypes: new Map(),
        },
        errorReporter: new TestErrorReporter('test.clawr'),
    } as const
}
