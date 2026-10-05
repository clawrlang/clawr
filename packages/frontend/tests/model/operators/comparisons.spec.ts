import { Comparison } from '@/model/operators'
import { IntegerRange, truthvalue, TruthvalueSet } from '@/model/value-set'
import { describe, expect, it, test } from 'bun:test'

describe('Comparisons', () => {
    describe('Value Equal (==)', () => {
        describe('integer operands', () => {
            it('evaluates equal integer literals as a singleton true', () => {
                const result = Comparison.equals.compute(
                    IntegerRange.singleton(2n),
                    IntegerRange.singleton(2n),
                )
                expect(result.isSuccess || result.error).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })

            it('evaluates different integer literals as a singleton false', () => {
                const result = Comparison.equals.compute(
                    IntegerRange.singleton(2n),
                    IntegerRange.singleton(3n),
                )
                expect(result.isSuccess || result.error).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })

            describe('integer ranges', () => {
                const examples = [
                    {
                        left: { min: 0n, max: 10n },
                        right: { min: 2n, max: 3n },
                        expected: ['true', 'false'] as truthvalue[],
                    },
                ]
                for (const { left, right, expected } of examples)
                    test(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] == [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
                        const result = Comparison.equals.compute(
                            IntegerRange.create(left),
                            IntegerRange.create(right),
                        )
                        expect(result.isSuccess || result.error).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: expect.arrayContaining(expected),
                        })
                    })
            })
        })

        describe('truthvalue operands', () => {
            it('evaluates equal truthvalue literals as a singleton true', () => {
                const result = Comparison.equals.compute(
                    TruthvalueSet.singleton('ambiguous'),
                    TruthvalueSet.singleton('ambiguous'),
                )
                expect(result.isSuccess || result.error).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })

            it('evaluates different truthvalue literals as a singleton false', () => {
                const result = Comparison.equals.compute(
                    TruthvalueSet.singleton('true'),
                    TruthvalueSet.singleton('ambiguous'),
                )
                expect(result.isSuccess || result.error).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })

            describe('truthvalue sets', () => {
                const examples = [
                    {
                        left: ['true', 'false'] as truthvalue[],
                        right: ['true', 'false'] as truthvalue[],
                        expected: ['true', 'false'] as truthvalue[],
                    },
                    {
                        left: ['true'] as truthvalue[],
                        right: ['false', 'ambiguous'] as truthvalue[],
                        expected: ['false'] as truthvalue[],
                    },
                ]
                for (const { left, right, expected } of examples)
                    test(`[${left}] == [${right}] -> [${expected}]`, () => {
                        const result = Comparison.equals.compute(
                            TruthvalueSet.create(left),
                            TruthvalueSet.create(right),
                        )
                        expect(result.isSuccess || result.error).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: expect.arrayContaining(expected),
                        })
                    })
            })
        })
    })

    describe('Value Not Equal (!=)', () => {
        describe('integer operands', () => {
            it('evaluates equal integer literals as a singleton false', () => {
                const result = Comparison.doesNotEqual.compute(
                    IntegerRange.singleton(2n),
                    IntegerRange.singleton(2n),
                )
                expect(result.isSuccess || result.error).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })

            it('evaluates different integer literals as a singleton true', () => {
                const result = Comparison.doesNotEqual.compute(
                    IntegerRange.singleton(2n),
                    IntegerRange.singleton(3n),
                )
                expect(result.isSuccess || result.error).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })

            describe('integer ranges', () => {
                const examples = [
                    {
                        left: { min: 0n, max: 10n },
                        right: { min: 2n, max: 3n },
                        expected: ['true', 'false'] as truthvalue[],
                    },
                ]
                for (const { left, right, expected } of examples)
                    test(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] != [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
                        const result = Comparison.doesNotEqual.compute(
                            IntegerRange.create(left),
                            IntegerRange.create(right),
                        )
                        expect(result.isSuccess || result.error).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: expect.arrayContaining(expected),
                        })
                    })
            })
        })

        describe('truthvalue operands', () => {
            it('evaluates equal truthvalue literals as a singleton false', () => {
                const result = Comparison.doesNotEqual.compute(
                    TruthvalueSet.singleton('ambiguous'),
                    TruthvalueSet.singleton('ambiguous'),
                )
                expect(result.isSuccess || result.error).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })

            it('evaluates different truthvalue literals as a singleton true', () => {
                const result = Comparison.doesNotEqual.compute(
                    TruthvalueSet.singleton('true'),
                    TruthvalueSet.singleton('ambiguous'),
                )
                expect(result.isSuccess || result.error).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })

            describe('truthvalue sets', () => {
                const examples = [
                    {
                        left: ['true', 'false'] as truthvalue[],
                        right: ['true', 'false'] as truthvalue[],
                        expected: ['true', 'false'] as truthvalue[],
                    },
                    {
                        left: ['true'] as truthvalue[],
                        right: ['false', 'ambiguous'] as truthvalue[],
                        expected: ['true'] as truthvalue[],
                    },
                ]
                for (const { left, right, expected } of examples)
                    test(`[${left}] != [${right}] -> [${expected}]`, () => {
                        const result = Comparison.doesNotEqual.compute(
                            TruthvalueSet.create(left),
                            TruthvalueSet.create(right),
                        )
                        expect(result.isSuccess || result.error).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: expect.arrayContaining(expected),
                        })
                    })
            })
        })
    })

    describe('Value Less Than (<)', () => {
        it('evaluates equal integer literals as a singleton false', () => {
            const result = Comparison.isLessThan.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(2n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['false'],
            })
        })

        it('evaluates different integer literals as a singleton true', () => {
            const result = Comparison.isLessThan.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['true'],
            })
        })

        it('evaluates different integer literals as a singleton false', () => {
            const result = Comparison.isLessThan.compute(
                IntegerRange.singleton(4n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['false'],
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    // All left values are less than the min right value
                    left: { max: 1n },
                    right: { min: 2n },
                    expected: ['true'] as truthvalue[],
                },
                {
                    // No left value is less than the max right value
                    left: { min: 2n },
                    right: { max: 2n },
                    expected: ['false'] as truthvalue[],
                },
                {
                    // Large overlap
                    left: { max: 3n },
                    right: { min: 2n },
                    expected: ['true', 'false'] as truthvalue[],
                },
            ]
            for (const { left, right, expected } of examples)
                test(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] < [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
                    const result = Comparison.isLessThan.compute(
                        IntegerRange.create(left),
                        IntegerRange.create(right),
                    )
                    expect(result.isSuccess || result.error).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: expect.arrayContaining(expected),
                    })
                })
        })
    })

    describe('Value Less Than Or Equal (<=)', () => {
        it('evaluates equal integer literals as a singleton true', () => {
            const result = Comparison.isLessThanOrEqual.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(2n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['true'],
            })
        })

        it('evaluates different integer literals as a singleton true', () => {
            const result = Comparison.isLessThanOrEqual.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['true'],
            })
        })

        it('evaluates different integer literals as a singleton false', () => {
            const result = Comparison.isLessThanOrEqual.compute(
                IntegerRange.singleton(4n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['false'],
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    // All left values are less than or equal to the min right value
                    left: { max: 2n },
                    right: { min: 2n },
                    expected: ['true'] as truthvalue[],
                },
                {
                    // No left value is less than or equal to the max right value
                    left: { min: 2n },
                    right: { max: 1n },
                    expected: ['false'] as truthvalue[],
                },
                {
                    // Large overlap
                    left: { max: 3n },
                    right: { min: 2n },
                    expected: ['true', 'false'] as truthvalue[],
                },
            ]
            for (const { left, right, expected } of examples)
                test(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] <= [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
                    const result = Comparison.isLessThanOrEqual.compute(
                        IntegerRange.create(left),
                        IntegerRange.create(right),
                    )
                    expect(result.isSuccess || result.error).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: expect.arrayContaining(expected),
                    })
                })
        })
    })

    describe('Value Greater Than (>)', () => {
        it('evaluates equal integer literals as a singleton false', () => {
            const result = Comparison.isGreaterThan.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(2n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['false'],
            })
        })

        it('evaluates different integer literals as a singleton true', () => {
            const result = Comparison.isGreaterThan.compute(
                IntegerRange.singleton(4n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['true'],
            })
        })

        it('evaluates different integer literals as a singleton false', () => {
            const result = Comparison.isGreaterThan.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['false'],
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    // All left values are greater than the max right value
                    left: { min: 2n },
                    right: { max: 1n },
                    expected: ['true'] as truthvalue[],
                },
                {
                    // No left value is greater than the max right value
                    left: { max: 2n },
                    right: { min: 2n },
                    expected: ['false'] as truthvalue[],
                },
                {
                    // Large overlap
                    left: { min: 3n },
                    right: { max: 3n },
                    expected: ['true', 'false'] as truthvalue[],
                },
            ]
            for (const { left, right, expected } of examples)
                test(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] > [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
                    const result = Comparison.isGreaterThan.compute(
                        IntegerRange.create(left),
                        IntegerRange.create(right),
                    )
                    expect(result.isSuccess || result.error).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: expect.arrayContaining(expected),
                    })
                })
        })
    })

    describe('Value Greater Than Or Equal (<=)', () => {
        it('evaluates equal integer literals as a singleton true', () => {
            const result = Comparison.isGreaterThanOrEqual.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(2n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['true'],
            })
        })

        it('evaluates different integer literals as a singleton true', () => {
            const result = Comparison.isGreaterThanOrEqual.compute(
                IntegerRange.singleton(4n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['true'],
            })
        })

        it('evaluates different integer literals as a singleton false', () => {
            const result = Comparison.isGreaterThanOrEqual.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                values: ['false'],
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    // All left values are greater than or equal to the max right value
                    left: { min: 2n },
                    right: { max: 2n },
                    expected: ['true'] as truthvalue[],
                },
                {
                    // No left value is greater than or equal to the min right value
                    left: { max: 1n },
                    right: { min: 2n },
                    expected: ['false'] as truthvalue[],
                },
                {
                    // Large overlap
                    left: { min: 2n },
                    right: { max: 3n },
                    expected: ['true', 'false'] as truthvalue[],
                },
            ]
            for (const { left, right, expected } of examples)
                test(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] >= [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
                    const result = Comparison.isGreaterThan.compute(
                        IntegerRange.create(left),
                        IntegerRange.create(right),
                    )
                    expect(result.isSuccess || result.error).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: expect.arrayContaining(expected),
                    })
                })
        })
    })
})
