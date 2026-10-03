import { ISOLATED } from '@/model/isolation-level'
import { Subtraction } from '@/model/operators/subtraction'
import { IntegerRange } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, test } from 'bun:test'

describe('Subtraction', () => {
    describe('integer operands', () => {
        describe('evaluates integer literals as a single value', () => {
            const expr = Subtraction.create({
                minuend: util.integerLiteral(2),
                subtrahend: util.integerLiteral(3),
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
                describe(`[${minuend.min ?? 'inf'},${minuend.max ?? 'inf'}]/[${subtrahend.min ?? 'inf'},${subtrahend.max ?? 'inf'}] == [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                    const context = util.newSemanticContext()
                    context.scope.addVariableDeclaration('minuend', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: IntegerRange.create(minuend),
                    })
                    context.scope.addVariableDeclaration('subtrahend', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: IntegerRange.create(subtrahend),
                    })

                    const expr = Subtraction.create({
                        minuend: util.variableRef('minuend'),
                        subtrahend: util.variableRef('subtrahend'),
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
        })
    })
})
