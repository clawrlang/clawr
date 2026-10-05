import { BinaryOperation } from '@/model/binary-operation'
import { ISOLATED } from '@/model/isolation-level'
import { IntegerRange } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, test } from 'bun:test'

describe('Multiplication', () => {
    describe('integer operands', () => {
        describe('evaluates integer literals as a single value', () => {
            const expr = BinaryOperation.create({
                operator: '*',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 6n,
                    max: 6n,
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 6n,
                    max: 6n,
                })
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    left: { min: 0n, max: 10n },
                    right: { min: 2n, max: 3n },
                    expected: { min: 0n, max: 30n },
                },
                {
                    left: { min: -10n, max: 5n },
                    right: { min: 2n, max: 10n },
                    expected: { min: -100n, max: 50n },
                },
                {
                    left: { min: 0n, max: 10n },
                    right: { min: -5n, max: -2n },
                    expected: { min: -50n, max: 0n },
                },
                {
                    // unbounded left operand
                    left: { min: 0n, max: undefined },
                    right: { min: 1n, max: 5n },
                    expected: { min: 0n, max: undefined },
                },
                {
                    // unbounded left operand
                    left: { min: undefined, max: 2n },
                    right: { min: 1n, max: 5n },
                    expected: { min: undefined, max: 10n },
                },
                {
                    // unbounded right operand
                    left: { min: -10n, max: 10n },
                    right: { min: 2n, max: undefined },
                    expected: { min: undefined, max: undefined },
                },
                {
                    // unbounded right operand
                    left: { min: -10n, max: 10n },
                    right: { min: undefined, max: 2n },
                    expected: { min: undefined, max: undefined },
                },
                {
                    // 0 * infinity is indeterminate; Clawr defines it as 0
                    left: { min: 0n, max: 0n },
                    right: { min: undefined, max: undefined },
                    expected: { min: 0n, max: 0n },
                },
            ]
            for (const { left, right, expected } of examples)
                describe(`[${left.min ?? 'inf'},${left.max ?? 'inf'}]/[${right.min ?? 'inf'},${right.max ?? 'inf'}] == [${expected.min ?? 'inf'},${expected.max ?? 'inf'}]`, () => {
                    const context = util.newSemanticContext()
                    context.scope.addVariableDeclaration('left', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: IntegerRange.create(left),
                    })
                    context.scope.addVariableDeclaration('right', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: IntegerRange.create(right),
                    })

                    const expr = BinaryOperation.create({
                        operator: '*',
                        left: util.variableRef('left'),
                        right: util.variableRef('right'),
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
