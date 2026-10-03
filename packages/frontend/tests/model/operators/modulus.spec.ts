import { ISOLATED } from '@/model/isolation-level'
import { Modulus } from '@/model/operators'
import { IntegerRange } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, test } from 'bun:test'

describe('Modulus', () => {
    describe('integer operands', () => {
        describe('evaluates integer literals as a single value', () => {
            const expr = Modulus.create({
                dividend: util.integerLiteral(21),
                divisor: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 0n,
                    max: 0n,
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 0n,
                    max: 0n,
                })
            })
        })

        describe('rounds down', () => {
            const expr = Modulus.create({
                dividend: util.integerLiteral(-2),
                divisor: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 1n,
                    max: 1n,
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 1n,
                    max: 1n,
                })
            })
        })

        describe('rounds down', () => {
            const expr = Modulus.create({
                dividend: util.integerLiteral(2),
                divisor: util.integerLiteral(-3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: -1n,
                    max: -1n,
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: -1n,
                    max: -1n,
                })
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
                describe(`[${dividend.min ?? 'inf'},${dividend.max ?? 'inf'}]%[${divisor.min ?? 'inf'},${divisor.max ?? 'inf'}] == [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                    const context = util.newSemanticContext()
                    context.scope.addVariableDeclaration('dividend', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: IntegerRange.create(dividend),
                    })
                    context.scope.addVariableDeclaration('divisor', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: IntegerRange.create(divisor),
                    })

                    const expr = Modulus.create({
                        dividend: util.variableRef('dividend'),
                        divisor: util.variableRef('divisor'),
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
                })

            describe('disallows zero divisor', () => {
                const context = util.newSemanticContext()
                context.scope.addVariableDeclaration('dividend', {
                    isImmutable: true,
                    isolationLevel: ISOLATED,
                    domain: IntegerRange.singleton(0n),
                })
                context.scope.addVariableDeclaration('divisor', {
                    isImmutable: true,
                    isolationLevel: ISOLATED,
                    domain: IntegerRange.singleton(0n),
                })

                const expr = Modulus.create({
                    dividend: util.variableRef('dividend'),
                    divisor: util.variableRef('divisor'),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(context)
                    expect(result.isError || result.value).toBeTrue()
                    expect(
                        result.isError &&
                            result.error.errors.map((e) => e.message),
                    ).toContain('division by zero')
                })
                test('currentValue', () => {
                    const result = expr.currentValue(context)
                    expect(result.isError || result.value).toBeTrue()
                    expect(
                        result.isError &&
                            result.error.errors.map((e) => e.message),
                    ).toContain('division by zero')
                })
            })
        })
    })
})
