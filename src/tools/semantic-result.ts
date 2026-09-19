import { SourceCodeSpan } from './diagnostics'
import { SemanticError } from './semantic-error'

export type SemanticResult<T = undefined> = Success<T> | Failure
export type Success<T = undefined> = { value: T }
type Failure = { errors: SemanticError[] }

export const SemanticResult = {
    true: success(true as const),
    false: success(false as const),
    success: success(),
    value<T>(value: T) {
        return success(value)
    },
    failure,

    collect,
}
function success(): Success
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
    [K in keyof T]: SemanticResult<T[K]>
}): SemanticResult<T> {
    const result: unknown[] = []
    const errors: SemanticError[] = []

    for (let i = 0; i < values.length; i++) {
        const value = values[i]
        if (isFailure(value)) errors.push(...value.errors)
        else result.push(value.value)
    }

    if (errors.length > 0) return failure(errors)

    return success(result as T)
}

export function isSuccess<T>(value: SemanticResult<T>): value is Success<T> {
    return 'value' in value
}

export function isFailure(value: SemanticResult<unknown>): value is Failure {
    return 'errors' in value
}
