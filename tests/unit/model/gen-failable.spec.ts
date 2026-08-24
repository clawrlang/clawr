import { describe, it, expect, test } from 'bun:test'
import { someCodeSpan } from '../../util'
import { GeneratorFailable } from '../../../src/model/gen-failable'
import { SemanticError } from '../../../src/model/failable'

describe('GeneratorFailable', () => {
    describe('success', () => {
        it('is successful', () => {
            expect(GeneratorFailable.success(42).isSuccess()).toBeTrue()
        })

        it('has no error', () => {
            expect(GeneratorFailable.success(42).isFailure()).toBeFalse()
        })

        it('has a resolved value', () => {
            expect(GeneratorFailable.success(42).value()).toBe(42)
        })
    })

    describe('failure', () => {
        it('is not successful', () => {
            expect(GeneratorFailable.failure(someError).isSuccess()).toBeFalse()
        })

        it('has an error', () => {
            expect(GeneratorFailable.failure(someError).isFailure()).toBeTrue()
        })

        it('throws when accessing value', () => {
            const error = SemanticError.create({
                message: 'This is an error',
                span: someCodeSpan,
            })
            expect(() => GeneratorFailable.failure(error).value()).toThrow(
                'This is an error',
            )
        })
    })

    describe('do', () => {
        it('unyields values', () => {
            let one: any, two: any, three: any
            const result = GeneratorFailable.do(function* () {
                one = yield GeneratorFailable.success(1)
                two = yield GeneratorFailable.success(2)
                three = yield GeneratorFailable.success(3)
                return GeneratorFailable.success(three as number)
            })
            expect(result.isFailure()).toBeFalse()
            expect(result.isSuccess()).toBeTrue()
            expect([one, two, three]).toEqual([1, 2, 3])
            expect(result.value()).toBe(3)
        })

        test('yield* returns nothing', () => {
            function* muchSuccess() {
                yield GeneratorFailable.success(1)
                yield GeneratorFailable.success(2)
                yield GeneratorFailable.success(3)
            }
            let yielded: any
            GeneratorFailable.do(function* () {
                yielded = yield* muchSuccess()
                return GeneratorFailable.success(undefined)
            })
            expect(yielded).toBeUndefined()
        })

        it('collects all non-fatal failures', () => {
            const result = GeneratorFailable.do(function* () {
                yield GeneratorFailable.success(1)
                yield GeneratorFailable.failure(
                    'This is does not end it',
                    someCodeSpan,
                )
                yield GeneratorFailable.failure(
                    'This also is does end it',
                    someCodeSpan,
                )
                yield GeneratorFailable.failure(
                    'This is the final thing',
                    someCodeSpan,
                )
                return GeneratorFailable.success(undefined)
            })
            expect(result.isFailure()).toBeTrue()
            expect((result as any).result.errors).toHaveLength(3)
        })

        it('returns the first fatal error', () => {
            const result = GeneratorFailable.do(function* () {
                yield GeneratorFailable.success(1)
                yield GeneratorFailable.failure(
                    'This is does not end it',
                    someCodeSpan,
                )
                yield GeneratorFailable.failure(
                    'This is does end it',
                    someCodeSpan,
                    { isFatal: true },
                )
                yield GeneratorFailable.failure(
                    'This is not touched',
                    someCodeSpan,
                )
                return GeneratorFailable.success(undefined)
            })
            expect(result.isFailure()).toBeTrue()
            expect((result as any).result.errors).toHaveLength(2)
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
