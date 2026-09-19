import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import { someCodeSpan } from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('SemanticResult', () => {
    describe('failure', () => {
        it('has an error', () => {
            const failure = SemanticErrorResult.failure(
                'someError',
                someCodeSpan,
            )
            expect(failure.error.errors).toHaveLength(1)
        })
    })

    describe('collect', () => {
        it('collects successful values', () => {
            const result = SemanticResult.collect([
                Result.value(1),
                Result.value(2),
                Result.value(3),
            ])
            expect(result.isError).toBeFalse()
            expect(result.isSuccess && result.value).toEqual([1, 2, 3])
        })

        it('collects failures', () => {
            const result = SemanticResult.collect([
                Result.value(1),
                SemanticErrorResult.failure(
                    'This is does not end it',
                    someCodeSpan,
                ),
                SemanticErrorResult.failure(
                    'This also is does end it',
                    someCodeSpan,
                ),
                SemanticErrorResult.failure(
                    'This is the final thing',
                    someCodeSpan,
                ),
            ])
            expect(result.isError && result.error.errors).toHaveLength(3)
        })
    })
})
