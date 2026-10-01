import { Exponential } from '@/model/exponential'
import { ISOLATED } from '@/model/isolation-level'
import { IntegerRange } from '@/model/value-set'
import {
    integerLiteral,
    newSemanticContext,
    someCodeSpan,
    variableRef,
} from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('Exponential', () => {
    describe('domain', () => {
        it('evaluates integer literals as a single value', () => {
            const expr = Exponential.create({
                base: integerLiteral(2),
                exponent: integerLiteral(3),
                span: someCodeSpan,
            })
            const result = expr.domain(newSemanticContext())
            expect(result.isSuccess || result.error.errors).toBeTrue()
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
            for (const { base, exponent, expected } of examples)
                test(`[${base.min ?? 'inf'},${base.max ?? 'inf'}]^[${exponent.min ?? 'inf'},${exponent.max ?? 'inf'}] == [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                    const context = newSemanticContext()
                    context.scope.addVariableDeclaration('base', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: IntegerRange.create(base),
                    })
                    context.scope.addVariableDeclaration('exponent', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: IntegerRange.create(exponent),
                    })

                    const expr = Exponential.create({
                        base: variableRef('base'),
                        exponent: variableRef('exponent'),
                        span: someCodeSpan,
                    })
                    const result = expr.domain(context)
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject(
                        expected,
                    )
                })
        })

        it('disallows negative integer exponent', () => {
            const expr = Exponential.create({
                base: integerLiteral(2),
                exponent: integerLiteral(-3),
                span: someCodeSpan,
            })
            const result = expr.domain(newSemanticContext())
            expect(result.isError || result.value).toBeTrue()
            expect(
                result.isError && result.error.errors.map((e) => e.message),
            ).toContain('negative exponent is not supported for integers')
        })
    })
})
