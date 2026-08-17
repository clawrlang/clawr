import { ErrorReporter, SourceCodeSpan } from '../diagnostics'

export class Failable<T = void> {
    private constructor(private result: T | SemanticErrorCollection) {}

    static success<T>(value: T): Failable<T> {
        return new Failable<T>(value)
    }

    static failure(message: string, span: SourceCodeSpan): Failable<never>
    static failure(error: SemanticErrorCollection): Failable<never>
    static failure(
        errorOrMessage: string | SemanticErrorCollection,
        span?: SourceCodeSpan,
    ): Failable<never> {
        if (errorOrMessage instanceof SemanticErrorCollection)
            return new Failable<never>(errorOrMessage)

        if (typeof errorOrMessage === 'string' && span) {
            return new Failable<never>(
                SemanticErrorCollection.create([
                    SemanticError.create({
                        message: errorOrMessage,
                        span: span,
                    }),
                ]),
            )
        }
        throw new Error('Invalid arguments for Failable.failure')
    }

    isSuccess(): boolean {
        return !this.isFailure()
    }

    isFailure(): this is Failable<never> {
        return this.result instanceof SemanticErrorCollection
    }

    value(): T {
        if (this.isFailure()) throw this.result
        return this.result as T
    }

    chaining<U>(fn: (value: T) => Failable<U>): Failable<U> {
        if (this.isFailure()) return this
        return fn(this.value())
    }

    static collect<T extends unknown[]>(values: {
        [K in keyof T]: Failable<T[K]>
    }): Failable<T> {
        const result: unknown[] = []
        const errors: SemanticError[] = []

        for (let i = 0; i < values.length; i++) {
            const value = values[i]
            if (value.isFailure()) {
                errors.push(...value.getError().errors)
            } else {
                result.push(value.value())
            }
        }

        if (errors.length > 0) {
            return Failable.failure(SemanticErrorCollection.create(errors))
        }

        return Failable.success(result as T)
    }

    throwIfFailure() {
        if (this.isFailure()) throw this.result
    }

    getError(): SemanticErrorCollection {
        if (this.isFailure()) return this.result
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

export class SemanticErrorCollection extends Error {
    private constructor(public errors: SemanticError[]) {
        super(errors.map((e) => e.message).join('\n'))
    }

    static create(errors: SemanticError[]): SemanticErrorCollection {
        return new SemanticErrorCollection(errors)
    }

    add(...errors: SemanticError[]): void {
        this.errors.push(...errors)
        this.message = this.errors.map((e) => e.message).join('\n')
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
