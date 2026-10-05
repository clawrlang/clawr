import { BinaryOperation } from '@/model/binary-operation'
import * as util from '@@/util'
import { describe, expect, describe as it, test } from 'bun:test'

describe('BinaryOperation', () => {
    describe('Logical OR', () => {
        it('evaluates truthvalue literals as singleton MAX truth', () => {
            const examples = [
                {
                    left: 'false',
                    right: 'ambiguous',
                    expected: 'ambiguous',
                },
                { left: 'ambiguous', right: 'true', expected: 'true' },
            ] as const
            for (const { left, right, expected } of examples) {
                describe(`[${left}] || [${right}] -> [${expected}]`, () => {
                    const expr = BinaryOperation.create({
                        operator: '||',
                        left: util.truthvalueLiteral(left),
                        right: util.truthvalueLiteral(right),
                        span: util.someCodeSpan,
                    })
                    test('domain', () => {
                        const result = expr.domain(util.newSemanticContext())
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: [expected],
                        })
                    })
                    test('currentValue', () => {
                        const result = expr.currentValue(
                            util.newSemanticContext(),
                        )
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: [expected],
                        })
                    })
                })
            }
        })
    })

    describe('Logical AND', () => {
        it('evaluates truthvalue literals as singleton MIN truth', () => {
            const examples = [
                { left: 'ambiguous', right: 'false', expected: 'false' },
                { left: 'true', right: 'ambiguous', expected: 'ambiguous' },
            ] as const
            for (const { left, right, expected } of examples) {
                describe(`[${left}] && [${right}] -> [${expected}]`, () => {
                    const expr = BinaryOperation.create({
                        operator: '&&',
                        left: util.truthvalueLiteral(left),
                        right: util.truthvalueLiteral(right),
                        span: util.someCodeSpan,
                    })
                    test('domain', () => {
                        const result = expr.domain(util.newSemanticContext())
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: [expected],
                        })
                    })
                    test('currentValue', () => {
                        const result = expr.currentValue(
                            util.newSemanticContext(),
                        )
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: [expected],
                        })
                    })
                })
            }
        })
    })

    describe('Comparisons', () => {
        it('evaluates ==', () => {
            const expr = BinaryOperation.create({
                operator: '==',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
        })

        it('evaluates !=', () => {
            const expr = BinaryOperation.create({
                operator: '!=',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
        })

        it('evaluates <', () => {
            const expr = BinaryOperation.create({
                operator: '<',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
        })

        it('evaluates <=', () => {
            const expr = BinaryOperation.create({
                operator: '<=',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
        })

        it('evaluates >', () => {
            const expr = BinaryOperation.create({
                operator: '>',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
        })

        it('evaluates >=', () => {
            const expr = BinaryOperation.create({
                operator: '>=',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
        })
    })

    describe('Addition', () => {
        it('evaluates integer literals as a single value', () => {
            const expr = BinaryOperation.create({
                operator: '+',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 5n,
                    max: 5n,
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 5n,
                    max: 5n,
                })
            })
        })
    })

    describe('Subtraction', () => {
        it('evaluates integer literals as a single value', () => {
            const expr = BinaryOperation.create({
                operator: '-',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: -1n,
                    max: -1n,
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: -1n,
                    max: -1n,
                })
            })
        })
    })

    describe('Multiplication', () => {
        it('evaluates integer literals as a single value', () => {
            const expr = BinaryOperation.create({
                operator: '*',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 6n,
                    max: 6n,
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 6n,
                    max: 6n,
                })
            })
        })
    })

    describe('Division', () => {
        it('evaluates integer literals as a single value', () => {
            const expr = BinaryOperation.create({
                operator: '/',
                left: util.integerLiteral(21),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 7n,
                    max: 7n,
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 7n,
                    max: 7n,
                })
            })
        })
    })

    describe('Modulus', () => {
        describe('integer operands', () => {
            it('evaluates integer literals as a single value', () => {
                const expr = BinaryOperation.create({
                    operator: '%',
                    left: util.integerLiteral(21),
                    right: util.integerLiteral(3),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        min: 0n,
                        max: 0n,
                    })
                })
                test('currentValue', () => {
                    const result = expr.currentValue(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        min: 0n,
                        max: 0n,
                    })
                })
            })
        })
    })

    describe('Exponential', () => {
        it('evaluates integer literals as a single value', () => {
            const expr = BinaryOperation.create({
                operator: '^',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 8n,
                    max: 8n,
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 8n,
                    max: 8n,
                })
            })
        })
    })
})
