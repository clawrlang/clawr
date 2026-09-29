import { SourceCodeSpan } from './diagnostics'
import { ErrorResult, Result, SuccessResult } from './result'
import { SemanticError, SemanticErrorCollection } from './semantic-error'

export type SemanticResult<T = undefined> =
    SuccessResult<T> | ErrorResult<SemanticErrorCollection>

export const SemanticResult = {
    collect<T extends unknown[]>(values: {
        [K in keyof T]: SemanticResult<T[K]>
    }): SemanticResult<T> {
        const result: unknown[] = []
        const errors: SemanticError[] = []

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
    ): ErrorResult<SemanticErrorCollection> {
        return this.errors([SemanticError.create({ message, span })])
    },
    errors(errors: SemanticError[]): ErrorResult<SemanticErrorCollection> {
        return ErrorResult.failure(SemanticErrorCollection.create(errors))
    },
}
