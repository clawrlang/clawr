export type Result<T = undefined> = SuccessResult<T> | ErrorResult
export type SuccessResult<T = undefined> = {
    isSuccess: true
    isError: false
    value: T
}
type ErrorResult = { isSuccess: false; isError: true; error: Error }

export const Result = {
    true: success(true as const),
    false: success(false as const),
    ok: success(undefined),
    value: success,
}

export const ErrorResult = {
    failure(errorOrMessage: string | Error): ErrorResult {
        return {
            isSuccess: false,
            isError: true,
            error:
                errorOrMessage instanceof Error
                    ? errorOrMessage
                    : new Error(errorOrMessage),
        }
    },
}
function success<T>(value?: T): SuccessResult<T> {
    return { isSuccess: true, isError: false, value: value as T }
}
