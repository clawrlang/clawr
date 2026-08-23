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

    chaining<U>(fn: (value: T) => U | Failable<U>): Failable<U> {
        if (this.isFailure()) return this
        return wrap(fn(this.value()))
    }

    static collect<T extends unknown[]>(values: {
        [K in keyof T]: T[K] | Failable<T[K]>
    }): Failable<T> {
        const result: unknown[] = []
        const errors: SemanticError[] = []

        for (let i = 0; i < values.length; i++) {
            const value = values[i]
            if (value instanceof Failable && value.isFailure())
                errors.push(...value.getError().errors)
            else result.push(unwrap(value))
        }

        if (errors.length > 0)
            return Failable.failure(SemanticErrorCollection.create(errors))

        return Failable.success(result as T)
    }

    static pipe<A, B>(
        value: Failable<A>,
        fn1: (input: A) => B | Failable<B>,
    ): Failable<B>
    static pipe<A, B, C>(
        value: Failable<A>,
        fn1: (input: A) => B | Failable<B>,
        fn2: (input: B) => C | Failable<C>,
    ): Failable<C>
    static pipe<A, B, C, D>(
        value: Failable<A>,
        fn1: (input: A) => B | Failable<B>,
        fn2: (input: B) => C | Failable<C>,
        fn3: (input: C) => D | Failable<D>,
    ): Failable<D>
    static pipe<A, B, C, D, E>(
        value: Failable<A>,
        fn1: (input: A) => B | Failable<B>,
        fn2: (input: B) => C | Failable<C>,
        fn3: (input: C) => D | Failable<D>,
        fn4: (input: D) => E | Failable<E>,
    ): Failable<E>
    static pipe(value: any, ...fns: Function[]): unknown {
        return fns.reduce((acc, fn) => {
            if (!(acc instanceof Failable)) return Failable.success(acc)
            return wrap(acc.isSuccess() ? fn(acc.value()) : acc)
        }, value)
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

function wrap<T>(result: T | Failable<T>): Failable<T> {
    return result instanceof Failable ? result : Failable.success(result)
}

function unwrap<T>(result: T | Failable<T>): T {
    return result instanceof Failable ? result.value() : result
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
export function pipeFailable<A, B, C>(
    value: Failable<A>,
    fn1: (input: A) => Failable<B>,
    fn2: (input: B) => Failable<C>,
): Failable<C>
export function pipeFailable(value: any, ...fns: Function[]): unknown {
    return fns.reduce(
        (acc: Failable<unknown>, fn) => (acc.isSuccess() ? fn(acc) : acc),
        value,
    )
}
