import { ErrorReporter, SourceCodeSpan } from '../diagnostics'

export class Failable<T> {
    private constructor(private result: T | SemanticError) {}

    static success<T>(value: T): Failable<T> {
        return new Failable(value)
    }

    static failure(message: string, span: SourceCodeSpan): Failable<never>
    static failure(error: SemanticError): Failable<never>
    static failure(
        errorOrMessage: string | SemanticError,
        span?: SourceCodeSpan,
    ): Failable<never> {
        if (typeof errorOrMessage === 'string' && span) {
            return new Failable<never>(
                SemanticError.create({ message: errorOrMessage, span: span }),
            )
        } else if (errorOrMessage instanceof SemanticError) {
            return new Failable<never>(errorOrMessage)
        }
        throw new Error('Invalid arguments for Failable.failure')
    }

    isSuccess(): boolean {
        return !this.isFailure()
    }

    isFailure(): boolean {
        return this.result instanceof SemanticError
    }

    value(): T {
        if (this.result instanceof SemanticError) throw this.result
        return this.result
    }

    map<U>(fn: (value: T) => Failable<U>): Failable<U> {
        if (this.isFailure()) return this as any
        return fn(this.value())
    }

    static collect<T>(values: Failable<T>[]): Failable<T[]> {
        return values.reduce(
            (acc, value) => {
                if (acc.isFailure()) return acc
                if (value.isFailure()) return value as any
                return Failable.success([...acc.value(), value.value()])
            },
            Failable.success([]) as Failable<T[]>,
        )
    }

    throwIfFailure() {
        if (this.result instanceof SemanticError) throw this.result
    }

    getError(): SemanticError {
        if (this.isFailure()) return this.result as SemanticError
        throw new Error('Cannot get error of a successful Failable')
    }
}

export class SemanticError extends Error {
    private constructor(
        message: string,
        public span: SourceCodeSpan,
    ) {
        super(message)
    }

    static create({
        message,
        span,
    }: {
        message: string
        span: SourceCodeSpan
    }) {
        return new SemanticError(message, span)
    }
}

export function logSemanticError(
    message: string,
    {
        span,
        errorReporter,
    }: {
        span: SourceCodeSpan
        errorReporter: ErrorReporter
        fatal?: false
    },
): void
export function logSemanticError(
    message: string,
    {
        span,
        errorReporter,
        fatal,
    }: {
        span: SourceCodeSpan
        errorReporter: ErrorReporter
        fatal: true
    },
): never
export function logSemanticError(
    message: string,
    {
        span,
        errorReporter,
        fatal,
    }: {
        span: SourceCodeSpan
        errorReporter: ErrorReporter
        fatal?: boolean
    },
): void {
    errorReporter.reportError(message, span)
    if (fatal) throw SemanticError.create({ message, span })
}
