import { ErrorResult, SuccessResult } from '@/tools/result'
import { describe, expect, it } from 'bun:test'

describe('Result', () => {
    describe('success', () => {
        it('is successful', () => {
            expect(SuccessResult.value(42).isSuccess).toBeTrue()
        })

        it('has no error', () => {
            expect(SuccessResult.value(42).isError).toBeFalse()
        })

        it('has a resolved value', () => {
            expect(SuccessResult.value(42).value).toBe(42)
        })
    })

    describe('failure', () => {
        it('is not successful', () => {
            expect(ErrorResult.failure('someError').isSuccess).toBeFalse()
        })

        it('has an error', () => {
            expect(ErrorResult.failure('someError').isError).toBeTrue()
            expect(
                ErrorResult.failure('this is the message').error.message,
            ).toBe('this is the message')
        })
    })
})
