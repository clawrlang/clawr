import { SourceCodeSpan } from './diagnostics'

export type Result<T> = Success<T> | Failure
type Success<T> = { value: T }
type Failure = { errors: SemanticError[] }

export const Failable = {
    success,
    undefined() {
        return success()
    },
    true() {
        return success(true)
    },
    false() {
        return success(false)
    },
    failure,
    collect,
    do: _do,
    map,
}

function success(): Success<undefined>
function success<T>(value: T): Success<T>
function success<T>(value?: T): Success<T> {
    return { value: value as T }
}

function failure(message: string, span: SourceCodeSpan): Failure
function failure(message: string, span: SourceCodeSpan): Failure
function failure(error: SemanticError | SemanticError[]): Failure
function failure(error: SemanticError | SemanticError[]): Failure
function failure(
    errorOrMessage: string | SemanticError | SemanticError[],
    ...options: [] | [SourceCodeSpan]
): Failure {
    if (errorOrMessage instanceof SemanticError)
        return { errors: [errorOrMessage] }

    if (Array.isArray(errorOrMessage)) return { errors: errorOrMessage }

    const span = options[0]
    if (!span || !('start' in span))
        throw new Error('Invalid arguments for Failable.failure')

    return {
        errors: [SemanticError.create({ message: errorOrMessage, span })],
    }
}

function collect<T extends unknown[]>(values: {
    [K in keyof T]: Result<T[K]>
}): Result<T> {
    const result: unknown[] = []
    const errors: SemanticError[] = []

    for (let i = 0; i < values.length; i++) {
        const value = values[i]
        if (isFailure(value)) errors.push(...value.errors)
        else result.push(value)
    }

    if (errors.length > 0) return failure(errors)

    return success(result as T)
}

export function isSuccess<T>(value: Result<T>): value is Success<T> {
    return 'value' in value
}

export function isFailure(value: Result<unknown>): value is Failure {
    return 'errors' in value
}

function _do<T>(generator: () => Failable<T>): Result<T> {
    const gen = generator()
    let generatorResult = gen.next()
    let result = generatorResult.value
    const errors: SemanticError[] = isFailure(result) ? result.errors : []

    while (!generatorResult.done) {
        generatorResult = gen.next(
            result && isSuccess(result) ? result.value : undefined,
        )
        result = generatorResult.value
        if (isFailure(result)) errors.push(...result.errors)
    }

    return errors.length
        ? failure(errors)
        : (generatorResult.value as Result<T>)
}

function* map<T, U>(
    items: T[],
    generator: (item: T) => Failable<U>,
): Failable<U[]> {
    const results: U[] = []

    for (const item of items) {
        const result = yield* generator(item)
        if ('errors' in result) return result
        results.push(result.value)
    }

    return { value: results }
}

export type Failable<T = void> = Generator<Result<unknown>, Result<T>, any>

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
