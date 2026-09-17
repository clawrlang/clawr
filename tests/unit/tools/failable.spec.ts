import { isFailure, isSuccess, Result, SemanticError } from '@/tools/failable'
import { someCodeSpan } from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('Failable', () => {
    describe('success', () => {
        it('is successful', () => {
            expect(isSuccess(Result.value(42))).toBeTrue()
        })

        it('has no error', () => {
            expect(isFailure(Result.value(42))).toBeFalse()
        })

        it('has a resolved value', () => {
            expect(Result.value(42).value).toBe(42)
        })
    })

    describe('failure', () => {
        it('is not successful', () => {
            expect(isSuccess(Result.failure(someError))).toBeFalse()
        })

        it('has an error', () => {
            expect(isFailure(Result.failure(someError))).toBeTrue()
            expect(Result.failure(someError).errors).toContainValue(someError)
        })
    })

    describe('collect', () => {
        it('collects successful values', () => {
            const result = Result.collect([
                Result.value(1),
                Result.value(2),
                Result.value(3),
            ])
            expect(isFailure(result)).toBeFalse()
            expect(isSuccess(result) && result.value).toEqual([1, 2, 3])
        })

        it('collects failures', () => {
            const result = Result.collect([
                Result.value(1),
                Result.failure('This is does not end it', someCodeSpan),
                Result.failure('This also is does end it', someCodeSpan),
                Result.failure('This is the final thing', someCodeSpan),
            ])
            expect(isFailure(result) && result.errors).toHaveLength(3)
        })
    })
})

const someError = SemanticError.create({
    message: 'error',
    span: {
        start: { line: 0, column: 0 },
        end: { line: 0, column: 0 },
    },
})
