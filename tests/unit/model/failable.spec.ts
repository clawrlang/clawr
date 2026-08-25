import { describe, it, expect } from 'bun:test'
import {
    SemanticError,
    SemanticErrorCollection,
} from '../../../src/model/failable'
import { someCodeSpan } from '../../util'
import { _Failable } from '../../../src/model/failable'

describe('Failable', () => {
    describe('success', () => {
        it('is successful', () => {
            expect(_Failable.success(42).isSuccess()).toBe(true)
        })

        it('has no error', () => {
            expect(() => _Failable.success(42).getError()).toThrow(
                'Cannot get error of a successful Failable',
            )
        })

        it('has a resolved value', () => {
            expect(_Failable.success(42).value()).toBe(42)
        })
    })

    describe('failure', () => {
        it('is not successful', () => {
            expect(_Failable.failure(someError).isSuccess()).toBe(false)
        })

        it('has an error', () => {
            const error = someError
            expect(_Failable.failure(error).getError()).toBe(error)
        })

        it('throws when accessing value', () => {
            const error = SemanticErrorCollection.create([
                SemanticError.create({
                    message: 'This is an error',
                    span: someCodeSpan,
                }),
            ])
            expect(() => _Failable.failure(error).value()).toThrow(
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
            const result = _Failable
                .success(42)
                .chaining((_) => _Failable.failure(error))
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
            const result = _Failable
                .failure(error)
                .chaining((_) => _Failable.success(42))
            expect(result.isSuccess()).toBe(false)
            expect(result.getError()).toBe(error)
        })

        it('can chain success with success', () => {
            const result = _Failable
                .success(42)
                .chaining((value) => _Failable.success(value + 1))
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
            const result = _Failable.collect([
                _Failable.success(1),
                _Failable.failure(error),
                _Failable.success(3),
            ])
            expect(result.isFailure()).toBe(true)
            expect(result.getError()).toEqual(error)
        })

        it('collects all successful values', () => {
            const result = _Failable.collect([
                _Failable.success(1),
                _Failable.success(2),
                _Failable.success(3),
            ])
            expect(result.isSuccess()).toBe(true)
            expect(result.value()).toEqual([1, 2, 3])
        })

        it('merges list of failables', () => {
            const result: _Failable<[number, string]> = _Failable.collect([
                _Failable.success(32),
                _Failable.success('hello'),
            ])
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
