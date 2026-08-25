import { describe, it, expect, test } from 'bun:test'
import { someCodeSpan } from '../../util'
import { Failable, isFailure, isSuccess } from '../../../src/model/gen-failable'
import { SemanticError } from '../../../src/model/failable'

describe('Failable', () => {
    describe('success', () => {
        it('is successful', () => {
            expect(isSuccess(Failable.success(42))).toBeTrue()
        })

        it('has no error', () => {
            expect(isFailure(Failable.success(42))).toBeFalse()
        })

        it('has a resolved value', () => {
            expect(Failable.success(42).value).toBe(42)
        })
    })

    describe('failure', () => {
        it('is not successful', () => {
            expect(isSuccess(Failable.failure(someError))).toBeFalse()
        })

        it('has an error', () => {
            expect(isFailure(Failable.failure(someError))).toBeTrue()
            expect(Failable.failure(someError).errors).toContainValue(someError)
        })
    })

    describe('do', () => {
        it('unyields values', () => {
            let one: any, two: any, three: any
            const result = Failable.do(function* () {
                one = yield Failable.success(1)
                two = yield Failable.success(2)
                three = yield Failable.success(3)
                return Failable.success(three as number)
            })
            expect(isFailure(result)).toBeFalse()
            expect(isSuccess(result)).toBeTrue()
            expect([one, two, three]).toEqual([1, 2, 3])
            expect((result as any).value).toBe(3)
        })

        test('yield* returns nothing', () => {
            function* muchSuccess() {
                yield Failable.success(1)
                yield Failable.success(2)
                yield Failable.success(3)
            }
            let yielded: any
            Failable.do(function* () {
                yielded = yield* muchSuccess()
                return Failable.success(undefined)
            })
            expect(yielded).toBeUndefined()
        })

        it('collects all non-fatal failures', () => {
            const result = Failable.do(function* () {
                yield Failable.success(1)
                yield Failable.failure('This is does not end it', someCodeSpan)
                yield Failable.failure('This also is does end it', someCodeSpan)
                yield Failable.failure('This is the final thing', someCodeSpan)
                return Failable.success(undefined)
            })
            expect(isFailure(result)).toBeTrue()
            expect((result as any).errors).toHaveLength(3)
        })

        it('returns the first fatal error', () => {
            const result = Failable.do(function* () {
                yield Failable.success(1)
                yield Failable.failure('This is does not end it', someCodeSpan)
                yield Failable.failure('This is does end it', someCodeSpan, {
                    isFatal: true,
                })
                yield Failable.failure('This is not touched', someCodeSpan)
                return Failable.success(undefined)
            })
            expect(isFailure(result)).toBeTrue()
            expect((result as any).errors).toHaveLength(2)
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
