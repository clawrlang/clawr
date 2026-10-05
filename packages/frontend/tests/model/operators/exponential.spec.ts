import { Exponential } from '@/model/operators'
import { IntegerRange } from '@/model/value-set'
import { describe, expect, it, test } from 'bun:test'

describe('Exponential', () => {
    it('evaluates integer singletons as a single value', () => {
        const result = Exponential.instance.compute(
            IntegerRange.singleton(2n),
            IntegerRange.singleton(3n),
        )
        expect(result.isSuccess || result.error).toBeTrue()
        expect(result.isSuccess && result.value).toMatchObject({
            min: 8n,
            max: 8n,
        })
    })

    describe('integer ranges', () => {
        const examples = [
            {
                base: { min: 0n, max: undefined },
                exponent: { min: 1n, max: undefined },
                expected: { min: 0n, max: undefined },
            },
            {
                base: { min: 0n, max: 10n },
                exponent: { min: 1n, max: 2n },
                expected: { min: 0n, max: 100n },
            },
            {
                base: { min: -10n, max: 0n },
                exponent: { min: 1n, max: 2n },
                expected: { min: -10n, max: 100n },
            },
            {
                // the largest exponent (3) is odd, so the max is not
                // base.min ** exponent.max but base.min raised to the
                // largest *even* exponent (2) instead
                base: { min: -10n, max: -1n },
                exponent: { min: 1n, max: 3n },
                expected: { min: -1000n, max: 100n },
            },
            {
                // entirely negative base, even exponent bound: the max
                // is base.min ** exponent.max, but the min comes from
                // the largest odd exponent (3), not exponent.min
                base: { min: -10n, max: -2n },
                exponent: { min: 1n, max: 4n },
                expected: { min: -1000n, max: 10000n },
            },
            {
                base: { min: -1n, max: -1n },
                exponent: { min: 0n, max: 5n },
                expected: { min: -1n, max: 1n },
            },
            {
                base: { min: -10n, max: 10n },
                exponent: { min: 1n, max: undefined },
                expected: { min: undefined, max: undefined },
            },
            {
                base: { min: -1n, max: 1n },
                exponent: { min: 1n, max: undefined },
                expected: { min: -1n, max: 1n },
            },
            {
                base: { min: -10n, max: -2n },
                exponent: { min: 0n, max: 0n },
                expected: { min: 1n, max: 1n },
            },
            {
                base: { min: -5n, max: 5n },
                exponent: { min: 0n, max: 0n },
                expected: { min: 1n, max: 1n },
            },
        ]
        for (const { base, exponent, expected } of examples) {
            test(`[${base.min ?? 'inf'},${base.max ?? 'inf'}]^[${exponent.min ?? 'inf'},${exponent.max ?? 'inf'}] -> [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                const result = Exponential.instance.compute(
                    IntegerRange.create(base),
                    IntegerRange.create(exponent),
                )
                expect(result.isSuccess || result.error).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject(expected)
            })
        }

        it('disallows 0^0 when both value sets are singletons', () => {
            const result = Exponential.instance.compute(
                IntegerRange.singleton(0n),
                IntegerRange.singleton(0n),
            )
            expect(result.isError || result.value).toBeTrue()
            expect(result.isError && result.error.message).toEqual(
                'The expression always evaluates to 0^0, which is undefined and will crash at runtime',
            )
        })

        it('disallows negative integer exponent', () => {
            const result = Exponential.instance.compute(
                IntegerRange.singleton(2n),
                IntegerRange.singleton(-3n),
            )
            expect(result.isError || result.value).toBeTrue()
            expect(result.isError && result.error.message).toEqual(
                'negative exponent is not supported for integers',
            )
        })
    })
})
