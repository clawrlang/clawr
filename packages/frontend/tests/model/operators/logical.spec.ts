import { BinaryOperation } from '@/model/binary-operation'
import { ISOLATED } from '@/model/isolation-level'
import { truthvalue, TruthvalueSet } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, describe as it, test } from 'bun:test'

describe('Logical', () => {
    describe('Logical OR', () => {
        it('evaluates truthvalue literals as singleton MAX truth', () => {
            const examples = [
                { left: 'false', right: 'false', expected: 'false' },
                { left: 'false', right: 'ambiguous', expected: 'ambiguous' },
                { left: 'false', right: 'true', expected: 'true' },
                { left: 'ambiguous', right: 'false', expected: 'ambiguous' },
                {
                    left: 'ambiguous',
                    right: 'ambiguous',
                    expected: 'ambiguous',
                },
                { left: 'ambiguous', right: 'true', expected: 'true' },
                { left: 'true', right: 'false', expected: 'true' },
                { left: 'true', right: 'ambiguous', expected: 'true' },
                { left: 'true', right: 'true', expected: 'true' },
            ] as const
            for (const { left, right, expected } of examples) {
                describe(`[${left}] || [${right}] -> [${expected}]`, () => {
                    const expr = BinaryOperation.create({
                        operator: '||',
                        left: util.truthvalueLiteral(left),
                        right: util.truthvalueLiteral(right),
                        span: util.someCodeSpan,
                    })
                    test('domain', () => {
                        const result = expr.domain(util.newSemanticContext())
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: [expected],
                        })
                    })
                    test('currentValue', () => {
                        const result = expr.currentValue(
                            util.newSemanticContext(),
                        )
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: [expected],
                        })
                    })
                })
            }
        })

        describe('truthvalue sets', () => {
            const examples = [
                {
                    left: ['true', 'false'] as truthvalue[],
                    right: ['true', 'false'] as truthvalue[],
                    expected: ['true', 'false'] as truthvalue[],
                },
                {
                    left: ['true', 'ambiguous'] as truthvalue[],
                    right: ['false', 'ambiguous'] as truthvalue[],
                    expected: ['ambiguous', 'true'] as truthvalue[],
                },
            ]
            for (const { left, right, expected } of examples)
                describe(`[${left}] || [${right}] -> [${expected}]`, () => {
                    const context = util.newSemanticContext()
                    context.scope.addVariableDeclaration('left', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: TruthvalueSet.create(left),
                    })
                    context.scope.addVariableDeclaration('right', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: TruthvalueSet.create(right),
                    })

                    const expr = BinaryOperation.create({
                        operator: '||',
                        left: util.variableRef('left'),
                        right: util.variableRef('right'),
                        span: util.someCodeSpan,
                    })

                    test('domain', () => {
                        const result = expr.domain(context)
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: expect.arrayContaining(expected),
                        })
                    })
                })
        })
    })

    describe('Logical AND', () => {
        it('evaluates truthvalue literals as singleton MIN truth', () => {
            const examples = [
                { left: 'false', right: 'false', expected: 'false' },
                { left: 'false', right: 'ambiguous', expected: 'false' },
                { left: 'false', right: 'true', expected: 'false' },
                { left: 'ambiguous', right: 'false', expected: 'false' },
                {
                    left: 'ambiguous',
                    right: 'ambiguous',
                    expected: 'ambiguous',
                },
                { left: 'ambiguous', right: 'true', expected: 'ambiguous' },
                { left: 'true', right: 'false', expected: 'false' },
                { left: 'true', right: 'ambiguous', expected: 'ambiguous' },
                { left: 'true', right: 'true', expected: 'true' },
            ] as const
            for (const { left, right, expected } of examples) {
                describe(`[${left}] && [${right}] -> [${expected}]`, () => {
                    const expr = BinaryOperation.create({
                        operator: '&&',
                        left: util.truthvalueLiteral(left),
                        right: util.truthvalueLiteral(right),
                        span: util.someCodeSpan,
                    })
                    test('domain', () => {
                        const result = expr.domain(util.newSemanticContext())
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: [expected],
                        })
                    })
                    test('currentValue', () => {
                        const result = expr.currentValue(
                            util.newSemanticContext(),
                        )
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: [expected],
                        })
                    })
                })
            }
        })

        describe('truthvalue sets', () => {
            const examples = [
                {
                    left: ['true', 'false'] as truthvalue[],
                    right: ['true', 'false'] as truthvalue[],
                    expected: ['true', 'false'] as truthvalue[],
                },
                {
                    left: ['true', 'ambiguous'] as truthvalue[],
                    right: ['false', 'ambiguous'] as truthvalue[],
                    expected: ['ambiguous', 'false'] as truthvalue[],
                },
            ]
            for (const { left, right, expected } of examples)
                describe(`[${left}] && [${right}] -> [${expected}]`, () => {
                    const context = util.newSemanticContext()
                    context.scope.addVariableDeclaration('left', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: TruthvalueSet.create(left),
                    })
                    context.scope.addVariableDeclaration('right', {
                        isImmutable: true,
                        isolationLevel: ISOLATED,
                        domain: TruthvalueSet.create(right),
                    })

                    const expr = BinaryOperation.create({
                        operator: '&&',
                        left: util.variableRef('left'),
                        right: util.variableRef('right'),
                        span: util.someCodeSpan,
                    })

                    test('domain', () => {
                        const result = expr.domain(context)
                        expect(
                            result.isSuccess || result.error.errors,
                        ).toBeTrue()
                        expect(result.isSuccess && result.value).toMatchObject({
                            values: expect.arrayContaining(expected),
                        })
                    })
                })
        })
    })
})
