import { describe, it, expect } from 'bun:test'
import {
    SemanticError,
    SemanticErrorCollection,
} from '../../../src/model/failable'
import { someCodeSpan } from '../../util'
import { Failable } from '../../../src/model/failable'

describe('Failable', () => {
    describe('success', () => {
        it('is successful', () => {
            expect(Failable.success(42).isSuccess()).toBe(true)
        })

        it('has no error', () => {
            expect(() => Failable.success(42).getError()).toThrow(
                'Cannot get error of a successful Failable',
            )
        })

        it('has a resolved value', () => {
            expect(Failable.success(42).value()).toBe(42)
        })
    })

    describe('failure', () => {
        it('is not successful', () => {
            expect(Failable.failure(someError).isSuccess()).toBe(false)
        })

        it('has an error', () => {
            const error = someError
            expect(Failable.failure(error).getError()).toBe(error)
        })

        it('throws when accessing value', () => {
            const error = SemanticErrorCollection.create([
                SemanticError.create({
                    message: 'This is an error',
                    span: someCodeSpan,
                }),
            ])
            expect(() => Failable.failure(error).value()).toThrow(
                'This is an error',
            )
        })
    })

    describe('chaining', () => {
        it('can chain success with failure', () => {
            const error = SemanticErrorCollection.create([
                SemanticError.create({
                    message: 'This is an error',
                    span: someCodeSpan,
                }),
            ])
            const result = Failable.success(42).map((_) =>
                Failable.failure(error),
            )
            expect(result.isFailure()).toBe(true)
            expect(result.getError()).toBe(error)
        })

        it('can chain failure with success', () => {
            const error = SemanticErrorCollection.create([
                SemanticError.create({
                    message: 'This is an error',
                    span: someCodeSpan,
                }),
            ])
            const result = Failable.failure(error).map((_) =>
                Failable.success(42),
            )
            expect(result.isSuccess()).toBe(false)
            expect(result.getError()).toBe(error)
        })

        it('can chain success with success', () => {
            const result = Failable.success(42).map((value) =>
                Failable.success(value + 1),
            )
            expect(result.isSuccess()).toBe(true)
            expect(result.value()).toBe(43)
        })
    })

    describe('collect', () => {
        it('returns the first failure', () => {
            const error = SemanticErrorCollection.create([
                SemanticError.create({
                    message: 'This is an error',
                    span: someCodeSpan,
                }),
            ])
            const result = Failable.collect([
                Failable.success(1),
                Failable.failure(error),
                Failable.success(3),
            ])
            expect(result.isFailure()).toBe(true)
            expect(result.getError()).toBe(error)
        })

        it('collects all successful values', () => {
            const result = Failable.collect([
                Failable.success(1),
                Failable.success(2),
                Failable.success(3),
            ])
            expect(result.isSuccess()).toBe(true)
            expect(result.value()).toEqual([1, 2, 3])
        })
    })
})

const someError = SemanticErrorCollection.create([
    SemanticError.create({
        message: 'error',
        span: {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 0 },
        },
    }),
])
