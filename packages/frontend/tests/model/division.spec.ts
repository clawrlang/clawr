import { Division } from '@/model/division'
import { ISOLATED } from '@/model/isolation-level'
import { IntegerRange } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, test } from 'bun:test'

describe('Division', () => {
    describe('integer operands', () => {
        describe('evaluates integer literals as a single value', () => {
            const expr = Division.create({
                numerator: util.integerLiteral(21),
                denominator: util.integerLiteral(3),
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
                numerator: util.integerLiteral(-2),
                denominator: util.integerLiteral(3),
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
                numerator: util.integerLiteral(2),
                denominator: util.integerLiteral(-3),
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
                    numerator: { min: 0n, max: 10n },
                    denominator: { min: 2n, max: 3n },
                    expected: { min: 0n, max: 5n },
                },
                {
                    numerator: { min: -10n, max: 10n },
                    denominator: { min: 2n, max: 5n },
                    expected: { min: -5n, max: 5n },
                },
                {
                    numerator: { min: 0n, max: 10n },
                    denominator: { min: -5n, max: -2n },
                    expected: { min: -5n, max: 0n },
                },
                {
                    numerator: { min: -10n, max: 10n },
                    denominator: { min: -5n, max: -2n },
                    expected: { min: -5n, max: 5n },
                },
                {
                    // unbounded numerator, positive denominator: grows
                    // without bound, but is still at least 0
                    numerator: { min: 0n, max: undefined },
                    denominator: { min: 1n, max: 5n },
                    expected: { min: 0n, max: undefined },
                },
                {
                    // unbounded denominator: as it grows, the quotient
                    // shrinks towards (but never past) its limit of -1/0
                    numerator: { min: -10n, max: 10n },
                    denominator: { min: 2n, max: undefined },
                    expected: { min: -5n, max: 5n },
                },
                {
                    numerator: { min: -10n, max: 10n },
                    denominator: { min: undefined, max: -2n },
                    expected: { min: -5n, max: 5n },
                },
            ]
            for (const { numerator, denominator, expected } of examples)
                describe(`[${numerator.min ?? 'inf'},${numerator.max ?? 'inf'}]/[${denominator.min ?? 'inf'},${denominator.max ?? 'inf'}] == [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                    const context = util.newSemanticContext()
                    context.scope.addVariableDeclaration('numerator', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: IntegerRange.create(numerator),
                    })
                    context.scope.addVariableDeclaration('denominator', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: IntegerRange.create(denominator),
                    })

                    const expr = Division.create({
                        numerator: util.variableRef('numerator'),
                        denominator: util.variableRef('denominator'),
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
                context.scope.addVariableDeclaration('numerator', {
                    isImmutable: true,
                    isolationLevel: ISOLATED,
                    domain: IntegerRange.singleton(0n),
                })
                context.scope.addVariableDeclaration('denominator', {
                    isImmutable: true,
                    isolationLevel: ISOLATED,
                    domain: IntegerRange.singleton(0n),
                })

                const expr = Division.create({
                    numerator: util.variableRef('numerator'),
                    denominator: util.variableRef('denominator'),
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

            describe('disallows a denominator range that can be zero', () => {
                const context = util.newSemanticContext()
                context.scope.addVariableDeclaration('numerator', {
                    isImmutable: true,
                    isolationLevel: ISOLATED,
                    domain: IntegerRange.singleton(5n),
                })
                context.scope.addVariableDeclaration('denominator', {
                    isImmutable: true,
                    isolationLevel: ISOLATED,
                    domain: IntegerRange.create({ min: -3n, max: 5n }),
                })

                const expr = Division.create({
                    numerator: util.variableRef('numerator'),
                    denominator: util.variableRef('denominator'),
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
            })
        })
    })
})
