import { SourceCodeSpan } from '@/tools/diagnostics'
import { ErrorResult, Result, SuccessResult } from '@/tools/result'
import { SourceError, SourceErrorCollection } from '@/tools/source-error'

export type SemanticResult<T = undefined> =
    SuccessResult<T> | ErrorResult<SourceErrorCollection>

export const SemanticResult = {
    collect<T extends unknown[]>(values: {
        [K in keyof T]: SemanticResult<T[K]>
    }): SemanticResult<T> {
        const result: unknown[] = []
        const errors: SourceError[] = []

        for (let i = 0; i < values.length; i++) {
            const value = values[i]
            if (!value.isSuccess) errors.push(...value.error.errors)
            else result.push(value.value)
        }

        if (errors.length > 0) return SemanticErrorResult.errors(errors)

        return Result.value(result as T)
    },
}

export const SemanticErrorResult = {
    failure(
        message: string,
        span: SourceCodeSpan,
    ): ErrorResult<SourceErrorCollection> {
        return this.errors([SourceError.create({ message, span })])
    },
    errors(errors: SourceError[]): ErrorResult<SourceErrorCollection> {
        return ErrorResult.failure(SourceErrorCollection.create(errors))
    },
}
