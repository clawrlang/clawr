import { Modulus } from '@/model/operators'
import { IntegerRange } from '@/model/value-set'
import { describe, expect, test } from 'bun:test'
import { it } from 'node:test'

describe('Modulus', () => {
    describe('integer operands', () => {
        it('evaluates integer literals as a single value', () => {
            const result = Modulus.instance.compute(
                IntegerRange.singleton(21n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                min: 0n,
                max: 0n,
            })
        })

        it('rounds down', () => {
            const result = Modulus.instance.compute(
                IntegerRange.singleton(-2n),
                IntegerRange.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                min: 1n,
                max: 1n,
            })
        })

        it('rounds down', () => {
            const result = Modulus.instance.compute(
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
                    dividend: { min: 0n, max: 100n },
                    divisor: { min: 7n, max: 7n },
                    expected: { min: 0n, max: 6n },
                },
                {
                    // dividend smaller than the divisor is unchanged
                    dividend: { min: 0n, max: 5n },
                    divisor: { min: 7n, max: 7n },
                    expected: { min: 0n, max: 5n },
                },
                {
                    dividend: { min: 7n, max: 7n },
                    divisor: { min: 4n, max: 6n },
                    expected: { min: 1n, max: 3n },
                },
                {
                    // negative dividend that doesn't wrap
                    dividend: { min: -3n, max: -1n },
                    divisor: { min: 5n, max: 5n },
                    expected: { min: 2n, max: 4n },
                },
                {
                    dividend: { min: 0n, max: 10n },
                    divisor: { min: -5n, max: -5n },
                    expected: { min: -4n, max: 0n },
                },
                {
                    dividend: { min: 0n, max: undefined },
                    divisor: { min: 3n, max: 3n },
                    expected: { min: 0n, max: 2n },
                },
                {
                    // unbounded divisor: result can't exceed the dividend
                    dividend: { min: 0n, max: 100n },
                    divisor: { min: 1n, max: undefined },
                    expected: { min: 0n, max: 100n },
                },
                {
                    // negative dividend: n + d grows with d
                    dividend: { min: -5n, max: -1n },
                    divisor: { min: 5n, max: undefined },
                    expected: { min: 0n, max: undefined },
                },
                {
                    // divisor spans zero
                    dividend: { min: 0n, max: 100n },
                    divisor: { min: -3n, max: 3n },
                    expected: { min: -2n, max: 2n },
                },
            ]
            for (const { dividend: dividend, divisor, expected } of examples)
                test(`[${dividend.min ?? 'inf'},${dividend.max ?? 'inf'}] % [${divisor.min ?? 'inf'},${divisor.max ?? 'inf'}] -> [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                    const result = Modulus.instance.compute(
                        IntegerRange.create(dividend),
                        IntegerRange.create(divisor),
                    )
                    expect(result.isSuccess || result.error).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject(
                        expected,
                    )
                })

            it('disallows zero divisor', () => {
                const result = Modulus.instance.compute(
                    IntegerRange.singleton(1n),
                    IntegerRange.singleton(0n),
                )
                expect(result.isError || result.value).toBeTrue()
                expect(result.isError && result.error.message).toContain(
                    'division by zero',
                )
            })
        })
    })
})
