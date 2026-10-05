import { Addition } from '@/model/operators'
import { IntegerRange } from '@/model/value-set'
import { describe, expect } from 'bun:test'

describe('Addition', () => {
    describe('integer operands', () => {
        describe('evaluates singleton integer ranges as a single value', () => {
            const result = Addition.instance.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                min: 5n,
                max: 5n,
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    left: { min: 0n, max: 10n },
                    right: { min: 2n, max: 3n },
                    expected: { min: 2n, max: 13n },
                },
                {
                    left: { min: -10n, max: 5n },
                    right: { min: 2n, max: 10n },
                    expected: { min: -8n, max: 15n },
                },
                {
                    // unbounded left operand
                    left: { min: 0n, max: undefined },
                    right: { min: 1n, max: 5n },
                    expected: { min: 1n, max: undefined },
                },
                {
                    // unbounded left operand
                    left: { min: undefined, max: 2n },
                    right: { min: 1n, max: 5n },
                    expected: { min: undefined, max: 7n },
                },
                {
                    // unbounded right operand
                    left: { min: -10n, max: 10n },
                    right: { min: 2n, max: undefined },
                    expected: { min: -8n, max: undefined },
                },
                {
                    // unbounded right operand
                    left: { min: -10n, max: 10n },
                    right: { min: undefined, max: 2n },
                    expected: { min: undefined, max: 12n },
                },
            ]
            for (const { left, right, expected } of examples)
                describe(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] + [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                    const result = Addition.instance.compute(
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
