import { Division } from '@/model/operators'
import { IntegerRange } from '@/model/value-set'
import { describe, expect, it, test } from 'bun:test'

describe('Division', () => {
    describe('integer operands', () => {
        it('evaluates integer literals as a single value', () => {
            const result = Division.instance.compute(
                IntegerRange.singleton(21n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                min: 7n,
                max: 7n,
            })
        })

        it('rounds down', () => {
            const result = Division.instance.compute(
                IntegerRange.singleton(-2n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                min: -1n,
                max: -1n,
            })
        })

        it('rounds down', () => {
            const result = Division.instance.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(-3n),
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
                    dividend: { min: 0n, max: 10n },
                    divisor: { min: 2n, max: 3n },
                    expected: { min: 0n, max: 5n },
                },
                {
                    dividend: { min: -10n, max: 10n },
                    divisor: { min: 2n, max: 5n },
                    expected: { min: -5n, max: 5n },
                },
                {
                    dividend: { min: 0n, max: 10n },
                    divisor: { min: -5n, max: -2n },
                    expected: { min: -5n, max: 0n },
                },
                {
                    dividend: { min: -10n, max: 10n },
                    divisor: { min: -5n, max: -2n },
                    expected: { min: -5n, max: 5n },
                },
                {
                    // unbounded dividend, positive divisor: grows
                    // without bound, but is still at least 0
                    dividend: { min: 0n, max: undefined },
                    divisor: { min: 1n, max: 5n },
                    expected: { min: 0n, max: undefined },
                },
                {
                    // unbounded divisor: as it grows, the quotient
                    // shrinks towards (but never past) its limit of -1/0
                    dividend: { min: -10n, max: 10n },
                    divisor: { min: 2n, max: undefined },
                    expected: { min: -5n, max: 5n },
                },
                {
                    dividend: { min: -10n, max: 10n },
                    divisor: { min: undefined, max: -2n },
                    expected: { min: -5n, max: 5n },
                },
                {
                    dividend: { min: -10n, max: 10n },
                    divisor: { min: -2n, max: 2n },
                    expected: { min: -10n, max: 10n },
                },
                {
                    // divisor spans zero with wide bounds: the extreme
                    // magnitude comes from dividing by ±1, not the far
                    // bounds (-50/50), which would give a much smaller result
                    dividend: { min: 100n, max: 100n },
                    divisor: { min: -50n, max: 50n },
                    expected: { min: -100n, max: 100n },
                },
            ]
            for (const { dividend: dividend, divisor, expected } of examples)
                test(`[${dividend.min ?? 'inf'},${dividend.max ?? 'inf'}] / [${divisor.min ?? 'inf'},${divisor.max ?? 'inf'}] -> [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                    const result = Division.instance.compute(
                        IntegerRange.create(dividend),
                        IntegerRange.create(divisor),
                    )
                    expect(result.isSuccess || result.error).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject(
                        expected,
                    )
                })

            describe('disallows zero divisor', () => {
                const result = Division.instance.compute(
                    IntegerRange.singleton(1n),
                    IntegerRange.singleton(0n),
                )
                expect(result.isError || result.value).toBeTrue()
                expect(result.isError && result.error.message).toEqual(
                    'division by zero',
                )
            })
        })
    })
})
