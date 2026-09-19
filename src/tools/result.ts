export type Result<T = undefined> = SuccessResult<T> | ErrorResult
export type SuccessResult<T = undefined> = { isSuccess: true; value: T }
type ErrorResult = { isSuccess: false; error: Error }

export const SuccessResult = {
    undefined: success(undefined),
    value: success,
}

export const ErrorResult = {
    failure(errorOrMessage: string | Error): ErrorResult {
        return {
            isSuccess: false,
            error:
                errorOrMessage instanceof Error
                    ? errorOrMessage
                    : new Error(errorOrMessage),
        }
    },
}
function success<T>(value?: T): SuccessResult<T> {
    return { isSuccess: true, value: value as T }
}
