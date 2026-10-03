import { ISOLATED } from '@/model/isolation-level'
import { Division } from '@/model/operators/division'
import { IntegerRange } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, test } from 'bun:test'

describe('Division', () => {
    describe('integer operands', () => {
        describe('evaluates integer literals as a single value', () => {
            const expr = Division.create({
                dividend: util.integerLiteral(21),
                divisor: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 7n,
                    max: 7n,
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 7n,
                    max: 7n,
                })
            })
        })

        describe('rounds down', () => {
            const expr = Division.create({
                dividend: util.integerLiteral(-2),
                divisor: util.integerLiteral(3),
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

        describe('rounds down', () => {
            const expr = Division.create({
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
                describe(`[${dividend.min ?? 'inf'},${dividend.max ?? 'inf'}]/[${divisor.min ?? 'inf'},${divisor.max ?? 'inf'}] == [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
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

                    const expr = Division.create({
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

                const expr = Division.create({
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
