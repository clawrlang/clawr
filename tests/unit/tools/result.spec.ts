import { SemanticError } from '@/tools/semantic-error'
import { isFailure, isSuccess, SemanticResult } from '@/tools/semantic-result'
import { someCodeSpan } from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('Result', () => {
    describe('success', () => {
        it('is successful', () => {
            expect(isSuccess(SemanticResult.value(42))).toBeTrue()
        })

        it('has no error', () => {
            expect(isFailure(SemanticResult.value(42))).toBeFalse()
        })

        it('has a resolved value', () => {
            expect(SemanticResult.value(42).value).toBe(42)
        })
    })

    describe('failure', () => {
        it('is not successful', () => {
            expect(isSuccess(SemanticResult.failure(someError))).toBeFalse()
        })

        it('has an error', () => {
            expect(isFailure(SemanticResult.failure(someError))).toBeTrue()
            expect(SemanticResult.failure(someError).errors).toContainValue(
                someError,
            )
        })
    })

    describe('collect', () => {
        it('collects successful values', () => {
            const result = SemanticResult.collect([
                SemanticResult.value(1),
                SemanticResult.value(2),
                SemanticResult.value(3),
            ])
            expect(isFailure(result)).toBeFalse()
            expect(isSuccess(result) && result.value).toEqual([1, 2, 3])
        })

        it('collects failures', () => {
            const result = SemanticResult.collect([
                SemanticResult.value(1),
                SemanticResult.failure('This is does not end it', someCodeSpan),
                SemanticResult.failure(
                    'This also is does end it',
                    someCodeSpan,
                ),
                SemanticResult.failure('This is the final thing', someCodeSpan),
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
