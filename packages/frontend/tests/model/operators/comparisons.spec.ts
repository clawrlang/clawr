import { BinaryOperation } from '@/model/binary-operation'
import { ISOLATED } from '@/model/isolation-level'
import { IntegerRange, truthvalue, TruthvalueSet } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, describe as it, test } from 'bun:test'

describe('Comparisons', () => {
    describe('Value Equal (==)', () => {
        describe('integer operands', () => {
            it('evaluates equal integer literals as a singleton true', () => {
                const expr = BinaryOperation.create({
                    operator: '==',
                    left: util.integerLiteral(2),
                    right: util.integerLiteral(2),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['true'],
                    })
                })
                test('currentValue', () => {
                    const result = expr.currentValue(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['true'],
                    })
                })
            })

            it('evaluates different integer literals as a singleton false', () => {
                const expr = BinaryOperation.create({
                    operator: '==',
                    left: util.integerLiteral(2),
                    right: util.integerLiteral(3),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['false'],
                    })
                })
                test('currentValue', () => {
                    const result = expr.currentValue(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['false'],
                    })
                })
            })

            describe('integer ranges', () => {
                const examples = [
                    {
                        left: { min: 0n, max: 10n },
                        right: { min: 2n, max: 3n },
                        expected: ['true', 'false'] as truthvalue[],
                    },
                ]
                for (const { left, right, expected } of examples)
                    describe(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] == [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
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
                            operator: '==',
                            left: util.variableRef('left'),
                            right: util.variableRef('right'),
                            span: util.someCodeSpan,
                        })

                        test('domain', () => {
                            const result = expr.domain(context)
                            expect(
                                result.isSuccess || result.error.errors,
                            ).toBeTrue()
                            expect(
                                result.isSuccess && result.value,
                            ).toMatchObject({
                                values: expect.arrayContaining(expected),
                            })
                        })
                    })
            })
        })

        describe('truthvalue operands', () => {
            it('evaluates equal truthvalue literals as a singleton true', () => {
                const expr = BinaryOperation.create({
                    operator: '==',
                    left: util.truthvalueLiteral('ambiguous'),
                    right: util.truthvalueLiteral('ambiguous'),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['true'],
                    })
                })
                test('currentValue', () => {
                    const result = expr.currentValue(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['true'],
                    })
                })
            })

            it('evaluates different truthvalue literals as a singleton false', () => {
                const expr = BinaryOperation.create({
                    operator: '==',
                    left: util.truthvalueLiteral('true'),
                    right: util.truthvalueLiteral('ambiguous'),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['false'],
                    })
                })
                test('currentValue', () => {
                    const result = expr.currentValue(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['false'],
                    })
                })
            })

            describe('truthvalue sets', () => {
                const examples = [
                    {
                        left: ['true', 'false'] as truthvalue[],
                        right: ['true', 'false'] as truthvalue[],
                        expected: ['true', 'false'] as truthvalue[],
                    },
                    {
                        left: ['true'] as truthvalue[],
                        right: ['false', 'ambiguous'] as truthvalue[],
                        expected: ['false'] as truthvalue[],
                    },
                ]
                for (const { left, right, expected } of examples)
                    describe(`[${left}] == [${right}]`, () => {
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
                            operator: '==',
                            left: util.variableRef('left'),
                            right: util.variableRef('right'),
                            span: util.someCodeSpan,
                        })

                        test('domain', () => {
                            const result = expr.domain(context)
                            expect(
                                result.isSuccess || result.error.errors,
                            ).toBeTrue()
                            expect(
                                result.isSuccess && result.value,
                            ).toMatchObject({
                                values: expect.arrayContaining(expected),
                            })
                        })
                    })
            })
        })
    })

    describe('Value Not Equal (!=)', () => {
        describe('integer operands', () => {
            it('evaluates equal integer literals as a singleton false', () => {
                const expr = BinaryOperation.create({
                    operator: '!=',
                    left: util.integerLiteral(2),
                    right: util.integerLiteral(2),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['false'],
                    })
                })
                test('currentValue', () => {
                    const result = expr.currentValue(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['false'],
                    })
                })
            })

            it('evaluates different integer literals as a singleton true', () => {
                const expr = BinaryOperation.create({
                    operator: '!=',
                    left: util.integerLiteral(2),
                    right: util.integerLiteral(3),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['true'],
                    })
                })
                test('currentValue', () => {
                    const result = expr.currentValue(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['true'],
                    })
                })
            })

            describe('integer ranges', () => {
                const examples = [
                    {
                        left: { min: 0n, max: 10n },
                        right: { min: 2n, max: 3n },
                        expected: ['true', 'false'] as truthvalue[],
                    },
                ]
                for (const { left, right, expected } of examples)
                    describe(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] != [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
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
                            operator: '!=',
                            left: util.variableRef('left'),
                            right: util.variableRef('right'),
                            span: util.someCodeSpan,
                        })

                        test('domain', () => {
                            const result = expr.domain(context)
                            expect(
                                result.isSuccess || result.error.errors,
                            ).toBeTrue()
                            expect(
                                result.isSuccess && result.value,
                            ).toMatchObject({
                                values: expect.arrayContaining(expected),
                            })
                        })
                    })
            })
        })

        describe('truthvalue operands', () => {
            it('evaluates equal truthvalue literals as a singleton false', () => {
                const expr = BinaryOperation.create({
                    operator: '!=',
                    left: util.truthvalueLiteral('ambiguous'),
                    right: util.truthvalueLiteral('ambiguous'),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['false'],
                    })
                })
                test('currentValue', () => {
                    const result = expr.currentValue(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['false'],
                    })
                })
            })

            it('evaluates different truthvalue literals as a singleton true', () => {
                const expr = BinaryOperation.create({
                    operator: '!=',
                    left: util.truthvalueLiteral('true'),
                    right: util.truthvalueLiteral('ambiguous'),
                    span: util.someCodeSpan,
                })
                test('domain', () => {
                    const result = expr.domain(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['true'],
                    })
                })
                test('currentValue', () => {
                    const result = expr.currentValue(util.newSemanticContext())
                    expect(result.isSuccess || result.error.errors).toBeTrue()
                    expect(result.isSuccess && result.value).toMatchObject({
                        values: ['true'],
                    })
                })
            })

            describe('truthvalue sets', () => {
                const examples = [
                    {
                        left: ['true', 'false'] as truthvalue[],
                        right: ['true', 'false'] as truthvalue[],
                        expected: ['true', 'false'] as truthvalue[],
                    },
                    {
                        left: ['true'] as truthvalue[],
                        right: ['false', 'ambiguous'] as truthvalue[],
                        expected: ['true'] as truthvalue[],
                    },
                ]
                for (const { left, right, expected } of examples)
                    describe(`[${left}] == [${right}] -> [${expected}]`, () => {
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
                            operator: '!=',
                            left: util.variableRef('left'),
                            right: util.variableRef('right'),
                            span: util.someCodeSpan,
                        })

                        test('domain', () => {
                            const result = expr.domain(context)
                            expect(
                                result.isSuccess || result.error.errors,
                            ).toBeTrue()
                            expect(
                                result.isSuccess && result.value,
                            ).toMatchObject({
                                values: expect.arrayContaining(expected),
                            })
                        })
                    })
            })
        })
    })

    describe('Value Less Than (<)', () => {
        it('evaluates equal integer literals as a singleton false', () => {
            const expr = BinaryOperation.create({
                operator: '<',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
        })

        it('evaluates different integer literals as a singleton true', () => {
            const expr = BinaryOperation.create({
                operator: '<',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
        })

        it('evaluates different integer literals as a singleton false', () => {
            const expr = BinaryOperation.create({
                operator: '<',
                left: util.integerLiteral(4),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    // All left values are less than the min right value
                    left: { max: 1n },
                    right: { min: 2n },
                    expected: ['true'] as truthvalue[],
                },
                {
                    // No left value is less than the max right value
                    left: { min: 2n },
                    right: { max: 2n },
                    expected: ['false'] as truthvalue[],
                },
                {
                    // Large overlap
                    left: { max: 3n },
                    right: { min: 2n },
                    expected: ['true', 'false'] as truthvalue[],
                },
            ]
            for (const { left, right, expected } of examples)
                describe(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] < [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
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
                        operator: '<',
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

    describe('Value Less Than Or Equal (<=)', () => {
        it('evaluates equal integer literals as a singleton true', () => {
            const expr = BinaryOperation.create({
                operator: '<=',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
        })

        it('evaluates different integer literals as a singleton true', () => {
            const expr = BinaryOperation.create({
                operator: '<=',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
        })

        it('evaluates different integer literals as a singleton false', () => {
            const expr = BinaryOperation.create({
                operator: '<=',
                left: util.integerLiteral(4),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    // All left values are less than or equal to the min right value
                    left: { max: 2n },
                    right: { min: 2n },
                    expected: ['true'] as truthvalue[],
                },
                {
                    // No left value is less than or equal to the max right value
                    left: { min: 2n },
                    right: { max: 1n },
                    expected: ['false'] as truthvalue[],
                },
                {
                    // Large overlap
                    left: { max: 3n },
                    right: { min: 2n },
                    expected: ['true', 'false'] as truthvalue[],
                },
            ]
            for (const { left, right, expected } of examples)
                describe(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] <= [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
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
                        operator: '<=',
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

    describe('Value Greater Than (>)', () => {
        it('evaluates equal integer literals as a singleton false', () => {
            const expr = BinaryOperation.create({
                operator: '>',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
        })

        it('evaluates different integer literals as a singleton true', () => {
            const expr = BinaryOperation.create({
                operator: '>',
                left: util.integerLiteral(4),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
        })

        it('evaluates different integer literals as a singleton false', () => {
            const expr = BinaryOperation.create({
                operator: '>',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    // All left values are greater than the max right value
                    left: { min: 2n },
                    right: { max: 1n },
                    expected: ['true'] as truthvalue[],
                },
                {
                    // No left value is greater than the max right value
                    left: { max: 2n },
                    right: { min: 2n },
                    expected: ['false'] as truthvalue[],
                },
                {
                    // Large overlap
                    left: { min: 3n },
                    right: { max: 3n },
                    expected: ['true', 'false'] as truthvalue[],
                },
            ]
            for (const { left, right, expected } of examples)
                describe(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] > [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
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
                        operator: '>',
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

    describe('Value Greater Than Or Equal (<=)', () => {
        it('evaluates equal integer literals as a singleton true', () => {
            const expr = BinaryOperation.create({
                operator: '>=',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
        })

        it('evaluates different integer literals as a singleton true', () => {
            const expr = BinaryOperation.create({
                operator: '>=',
                left: util.integerLiteral(4),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['true'],
                })
            })
        })

        it('evaluates different integer literals as a singleton false', () => {
            const expr = BinaryOperation.create({
                operator: '>=',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('domain', () => {
                const result = expr.domain(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: ['false'],
                })
            })
        })

        describe('integer ranges', () => {
            const examples = [
                {
                    // All left values are greater than or equal to the max right value
                    left: { min: 2n },
                    right: { max: 2n },
                    expected: ['true'] as truthvalue[],
                },
                {
                    // No left value is greater than or equal to the min right value
                    left: { max: 1n },
                    right: { min: 2n },
                    expected: ['false'] as truthvalue[],
                },
                {
                    // Large overlap
                    left: { min: 2n },
                    right: { max: 3n },
                    expected: ['true', 'false'] as truthvalue[],
                },
            ]
            for (const { left, right, expected } of examples)
                describe(`[${left.min ?? 'inf'},${left.max ?? 'inf'}] >= [${right.min ?? 'inf'},${right.max ?? 'inf'}] -> ${expected}`, () => {
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
                        operator: '>=',
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
