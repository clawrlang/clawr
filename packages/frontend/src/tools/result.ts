export type Result<T = undefined, E extends Error = Error> =
    SuccessResult<T> | ErrorResult<E>
export type SuccessResult<T = undefined> = {
    isSuccess: true
    isError: false
    value: T
}
export type ErrorResult<E extends Error = Error> = {
    isSuccess: false
    isError: true
    error: E
}

export const Result = {
    true: success(true as const),
    false: success(false as const),
    ok: success(undefined),
    value: success,
}

export const ErrorResult = {
    failure,
}
function success<T>(value?: T): SuccessResult<T> {
    return { isSuccess: true, isError: false, value: value as T }
}

function failure<E extends Error>(error: E): ErrorResult<E>
function failure(error: string): ErrorResult
function failure(errorOrMessage: string | Error): ErrorResult {
    return {
        isSuccess: false,
        isError: true,
        error:
            errorOrMessage instanceof Error
                ? errorOrMessage
                : new Error(errorOrMessage),
    }
}
