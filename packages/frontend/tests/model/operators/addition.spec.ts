import { Addition } from '@/model/operators'
import { IntegerSet, RealSet } from '@/model/value-set'
import { describe, expect, it } from 'bun:test'

describe('Addition', () => {
    describe('integer operands', () => {
        describe('evaluates singleton integer ranges as a single value', () => {
            const result = Addition.instance.compute(
                IntegerSet.singleton(2n),
                IntegerSet.singleton(3n),
            )
            expect(result.isSuccess || result.error).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                min: 5n,
                max: 5n,
            })

            describe('real operands', () => {
                it('uses the higher operand precision when kinds and bases match', () => {
                    const result = Addition.instance.compute(
                        RealSet.unconstrained({
                            kind: 'sig',
                            digits: 2,
                            base: 'dec',
                        }),
                        RealSet.unconstrained({
                            kind: 'sig',
                            digits: 4,
                            base: 'dec',
                        }),
                    )

                    expect(result.isSuccess).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        precision: { kind: 'sig', digits: 4, base: 'dec' },
                    })
                })

                it('rejects mixed precision bases', () => {
                    const result = Addition.instance.compute(
                        RealSet.unconstrained({
                            kind: 'sig',
                            digits: 2,
                            base: 'dec',
                        }),
                        RealSet.unconstrained({
                            kind: 'sig',
                            digits: 4,
                            base: 'bin',
                        }),
                    )

                    expect(result.isError).toBeTrue()
                })

                it('treats an integer operand as scale 0', () => {
                    const result = Addition.instance.compute(
                        IntegerSet.singleton(2n),
                        RealSet.unconstrained({
                            kind: 'scale',
                            digits: 2,
                            base: 'dec',
                        }),
                    )

                    expect(result.isSuccess && result.value).toMatchObject({
                        precision: { kind: 'scale', digits: 2, base: 'dec' },
                    })
                })
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
                        IntegerSet.range(left),
                        IntegerSet.range(right),
                    )
                    expect(result.isSuccess || result.error).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject(
                        expected,
                    )
                })
        })
    })
})
