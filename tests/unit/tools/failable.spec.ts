import {
    Failable,
    isFailure,
    isSuccess,
    Result,
    SemanticError,
} from '@/tools/failable'
import { someCodeSpan } from '@@/util'
import { describe, expect, it, test } from 'bun:test'

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

    describe('do', () => {
        it('unyields values', () => {
            let one: any, two: any, three: any
            const result = Failable.do(function* () {
                one = yield Result.value(1)
                two = yield Result.value(2)
                three = yield Result.value(3)
                return Result.value(three as number)
            })
            expect(isFailure(result)).toBeFalse()
            expect(isSuccess(result)).toBeTrue()
            expect([one, two, three]).toEqual([1, 2, 3])
            expect((result as any).value).toBe(3)
        })

        test('yield* returns nothing', () => {
            function* muchSuccess() {
                yield Result.value(1)
                yield Result.value(2)
                yield Result.value(3)
            }
            let yielded: any
            Failable.do(function* () {
                yielded = yield* muchSuccess()
                return Result.success
            })
            expect(yielded).toBeUndefined()
        })

        it('collects all non-fatal failures', () => {
            const result = Failable.do(function* () {
                yield Result.value(1)
                yield Result.failure('This is does not end it', someCodeSpan)
                yield Result.failure('This also is does end it', someCodeSpan)
                yield Result.failure('This is the final thing', someCodeSpan)
                return Result.success
            })
            expect(isFailure(result)).toBeTrue()
            expect((result as any).errors).toHaveLength(3)
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
