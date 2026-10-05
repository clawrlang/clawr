import { Subtraction } from '@/model/operators'
import { IntegerRange } from '@/model/value-set'
import { describe, expect, it, test } from 'bun:test'

describe('Subtraction', () => {
    describe('integer operands', () => {
        it('evaluates integer literals as a single value', () => {
            const result = Subtraction.instance.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                min: -1n,
                max: -1n,
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    minuend: { min: 0n, max: 10n },
                    subtrahend: { min: 2n, max: 3n },
                    expected: { min: -3n, max: 8n },
                },
                {
                    minuend: { min: -10n, max: 5n },
                    subtrahend: { min: 2n, max: 10n },
                    expected: { min: -20n, max: 3n },
                },
                {
                    // unbounded minuend
                    minuend: { min: 0n, max: undefined },
                    subtrahend: { min: 1n, max: 5n },
                    expected: { min: -5n, max: undefined },
                },
                {
                    // unbounded minuend
                    minuend: { min: undefined, max: 2n },
                    subtrahend: { min: 1n, max: 5n },
                    expected: { min: undefined, max: 1n },
                },
                {
                    // unbounded subtrahend
                    minuend: { min: -10n, max: 10n },
                    subtrahend: { min: 2n, max: undefined },
                    expected: { min: undefined, max: 8n },
                },
                {
                    // unbounded subtrahend
                    minuend: { min: -10n, max: 10n },
                    subtrahend: { min: undefined, max: 2n },
                    expected: { min: -12n, max: undefined },
                },
            ]
            for (const { minuend, subtrahend, expected } of examples)
                test(`[${minuend.min ?? 'inf'},${minuend.max ?? 'inf'}] - [${subtrahend.min ?? 'inf'},${subtrahend.max ?? 'inf'}] -> [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                    const result = Subtraction.instance.compute(
                        IntegerRange.create(minuend),
                        IntegerRange.create(subtrahend),
                    )
                    expect(result.isSuccess || result.error).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject(
                        expected,
                    )
                })
        })
    })
})
