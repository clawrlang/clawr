import { BinaryOperation } from '@/model/binary-operation'
import { ISOLATED } from '@/model/isolation-level'
import { IntegerRange } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, test } from 'bun:test'

describe('Exponential', () => {
    describe('integer operands', () => {
        describe('evaluates integer literals as a single value', () => {
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
                describe(`[${base.min ?? 'inf'},${base.max ?? 'inf'}]^[${exponent.min ?? 'inf'},${exponent.max ?? 'inf'}] == [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                    const context = util.newSemanticContext()
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

                    const expr = BinaryOperation.create({
                        operator: '^',
                        left: util.variableRef('base'),
                        right: util.variableRef('exponent'),
                        span: util.someCodeSpan,
                    })
                    test('domain', () => {
                        const result = expr.domain(context)
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject(
                            expected,
                        )
                    })

                    test('currentValue', () => {
                        const result = expr.currentValue(context)
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject(
                            expected,
                        )
                    })
                })
            }

            describe('disallows 0^0 when both value sets are singletons', () => {
                const context = util.newSemanticContext()
                context.scope.addVariableDeclaration('base', {
                    isImmutable: true,
                    isolationLevel: ISOLATED,
                    domain: IntegerRange.create({ min: 0n, max: 0n }),
                })
                context.scope.addVariableDeclaration('exponent', {
                    isImmutable: true,
                    isolationLevel: ISOLATED,
                    domain: IntegerRange.create({ min: 0n, max: 0n }),
                })

                const expr = BinaryOperation.create({
                    operator: '^',
                    left: util.variableRef('base'),
                    right: util.variableRef('exponent'),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(context)
                    expect(result.isError || result.value).toBeTrue()
                    expect(
                        result.isError &&
                            result.error.errors.map((e) => e.message),
                    ).toContain(
                        'The expression always evaluates to 0^0, which is undefined and will crash at runtime',
                    )
                })
                test('currentValue', () => {
                    const result = expr.currentValue(context)
                    expect(result.isError || result.value).toBeTrue()
                    expect(
                        result.isError &&
                            result.error.errors.map((e) => e.message),
                    ).toContain(
                        'The expression always evaluates to 0^0, which is undefined and will crash at runtime',
                    )
                })
            })

            describe('disallows negative integer exponent', () => {
                const expr = BinaryOperation.create({
                    operator: '^',
                    left: util.integerLiteral(2),
                    right: util.integerLiteral(-3),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(util.newSemanticContext())
                    expect(result.isError || result.value).toBeTrue()
                    expect(
                        result.isError &&
                            result.error.errors.map((e) => e.message),
                    ).toContain(
                        'negative exponent is not supported for integers',
                    )
                })
                test('currentValue', () => {
                    const result = expr.currentValue(util.newSemanticContext())
                    expect(result.isError || result.value).toBeTrue()
                    expect(
                        result.isError &&
                            result.error.errors.map((e) => e.message),
                    ).toContain(
                        'negative exponent is not supported for integers',
                    )
                })
            })
        })
    })
})
