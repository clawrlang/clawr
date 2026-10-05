import { Multiplication } from '@/model/operators'
import { IntegerRange } from '@/model/value-set'
import { describe, expect, it, test } from 'bun:test'

describe('Multiplication', () => {
    describe('integer operands', () => {
        it('evaluates integer literals as a single value', () => {
            const result = Multiplication.instance.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                min: 6n,
                max: 6n,
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    left: { min: 0n, max: 10n },
                    right: { min: 2n, max: 3n },
                    expected: { min: 0n, max: 30n },
                },
                {
                    left: { min: -10n, max: 5n },
                    right: { min: 2n, max: 10n },
                    expected: { min: -100n, max: 50n },
                },
                {
                    left: { min: 0n, max: 10n },
                    right: { min: -5n, max: -2n },
                    expected: { min: -50n, max: 0n },
                },
                {
                    // unbounded left operand
                    left: { min: 0n, max: undefined },
                    right: { min: 1n, max: 5n },
                    expected: { min: 0n, max: undefined },
                },
                {
                    // unbounded left operand
                    left: { min: undefined, max: 2n },
                    right: { min: 1n, max: 5n },
                    expected: { min: undefined, max: 10n },
                },
                {
                    // unbounded right operand
                    left: { min: -10n, max: 10n },
                    right: { min: 2n, max: undefined },
                    expected: { min: undefined, max: undefined },
                },
                {
                    // unbounded right operand
                    left: { min: -10n, max: 10n },
                    right: { min: undefined, max: 2n },
                    expected: { min: undefined, max: undefined },
                },
                {
                    // 0 * infinity is indeterminate; Clawr defines it as 0
                    left: { min: 0n, max: 0n },
                    right: { min: undefined, max: undefined },
                    expected: { min: 0n, max: 0n },
                },
            ]
            for (const { left, right, expected } of examples)
                test(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] * [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                    const result = Multiplication.instance.compute(
                        IntegerRange.create(left),
                        IntegerRange.create(right),
                    )
                    expect(result.isSuccess || result.error).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject(
                        expected,
                    )
                })
        })
    })
})
