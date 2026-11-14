import { BinaryOperation } from '@/model/binary-operation'
import * as util from '@@/util'
import { describe, expect, describe as it, test } from 'bun:test'

describe('BinaryOperation', () => {
    test('encodes short-circuit evaluation as scoped CIR branches', () => {
        for (const [operator, kind, stop] of [
            ['&&', 'AND', 'false'],
            ['||', 'OR', 'true'],
        ] as const) {
            const result = BinaryOperation.create({
                operator,
                left: util.truthvalueLiteral('ambiguous'),
                right: util.truthvalueLiteral('true'),
                span: util.someCodeSpan,
            }).toCIRExpression(util.newSemanticContext())
            if (result.isError) throw result.error
            expect(result.value).toMatchObject({
                kind: 'SCOPE',
                statements: [
                    {
                        kind: 'VARIABLE_DECL',
                        name: '__tempˇ0',
                        initialValue: {
                            kind: 'TRUTHVALUE_LITERAL',
                            type: { value: 'ambiguous' },
                        },
                    },
                    {
                        kind: 'IF',
                        condition: {
                            kind: 'NOT_EQUAL',
                            left: { kind: 'VARIABLE_REF', name: '__tempˇ0' },
                            right: { type: { value: stop } },
                        },
                        then: [
                            {
                                kind: 'ASSIGN',
                                target: { name: '__tempˇ0' },
                                value: {
                                    kind,
                                    left: { name: '__tempˇ0' },
                                    right: { kind: 'TRUTHVALUE_LITERAL' },
                                },
                            },
                        ],
                    },
                ],
                value: { kind: 'VARIABLE_REF', name: '__tempˇ0' },
            })
        }
    })

    describe('Logical OR', () => {
        it('evaluates truthvalue literals as singleton MAX truth', () => {
            const examples = [
                {
                    left: 'false',
                    right: 'ambiguous',
                    expected: 'ambiguous',
                },
                { left: 'ambiguous', right: 'true', expected: 'true' },
            ] as const
            for (const { left, right, expected } of examples) {
                describe(`[${left}] || [${right}] -> [${expected}]`, () => {
                    const expr = BinaryOperation.create({
                        operator: '||',
                        left: util.truthvalueLiteral(left),
                        right: util.truthvalueLiteral(right),
                        span: util.someCodeSpan,
                    })
                    test('type', () => {
                        const result = expr.type(util.newSemanticContext())
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
    })

    describe('Logical AND', () => {
        it('evaluates truthvalue literals as singleton MIN truth', () => {
            const examples = [
                { left: 'ambiguous', right: 'false', expected: 'false' },
                { left: 'true', right: 'ambiguous', expected: 'ambiguous' },
            ] as const
            for (const { left, right, expected } of examples) {
                describe(`[${left}] && [${right}] -> [${expected}]`, () => {
                    const expr = BinaryOperation.create({
                        operator: '&&',
                        left: util.truthvalueLiteral(left),
                        right: util.truthvalueLiteral(right),
                        span: util.someCodeSpan,
                    })
                    test('type', () => {
                        const result = expr.type(util.newSemanticContext())
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
    })

    describe('Comparisons', () => {
        it('evaluates ==', () => {
            const expr = BinaryOperation.create({
                operator: '==',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('type', () => {
                const result = expr.type(util.newSemanticContext())
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

        it('evaluates !=', () => {
            const expr = BinaryOperation.create({
                operator: '!=',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('type', () => {
                const result = expr.type(util.newSemanticContext())
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

        it('evaluates <', () => {
            const expr = BinaryOperation.create({
                operator: '<',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('type', () => {
                const result = expr.type(util.newSemanticContext())
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

        it('evaluates <=', () => {
            const expr = BinaryOperation.create({
                operator: '<=',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('type', () => {
                const result = expr.type(util.newSemanticContext())
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

        it('evaluates >', () => {
            const expr = BinaryOperation.create({
                operator: '>',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('type', () => {
                const result = expr.type(util.newSemanticContext())
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

        it('evaluates >=', () => {
            const expr = BinaryOperation.create({
                operator: '>=',
                left: util.integerLiteral(2),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            test('type', () => {
                const result = expr.type(util.newSemanticContext())
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
    })

    describe('Addition', () => {
        it('evaluates integer literals as a single value', () => {
            const expr = BinaryOperation.create({
                operator: '+',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('type', () => {
                const result = expr.type(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 5n,
                    max: 5n,
                })
            })
            test('currentValue', () => {
                const result = expr.currentValue(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value).toMatchObject({
                    min: 5n,
                    max: 5n,
                })
            })
        })
    })

    describe('Subtraction', () => {
        it('evaluates integer literals as a single value', () => {
            const expr = BinaryOperation.create({
                operator: '-',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('type', () => {
                const result = expr.type(util.newSemanticContext())
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
    })

    describe('Multiplication', () => {
        it('evaluates integer literals as a single value', () => {
            const expr = BinaryOperation.create({
                operator: '*',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('type', () => {
                const result = expr.type(util.newSemanticContext())
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
    })

    describe('Division', () => {
        it('evaluates integer literals as a single value', () => {
            const expr = BinaryOperation.create({
                operator: '/',
                left: util.integerLiteral(21),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('type', () => {
                const result = expr.type(util.newSemanticContext())
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
    })

    describe('Modulus', () => {
        describe('integer operands', () => {
            it('evaluates integer literals as a single value', () => {
                const expr = BinaryOperation.create({
                    operator: '%',
                    left: util.integerLiteral(21),
                    right: util.integerLiteral(3),
                    span: util.someCodeSpan,
                })
                test('type', () => {
                    const result = expr.type(util.newSemanticContext())
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
        })
    })

    describe('Exponential', () => {
        it('evaluates integer literals as a single value', () => {
            const expr = BinaryOperation.create({
                operator: '^',
                left: util.integerLiteral(2),
                right: util.integerLiteral(3),
                span: util.someCodeSpan,
            })
            test('type', () => {
                const result = expr.type(util.newSemanticContext())
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
    })

    describe('toCIRExpression', () => {
        it('lowers integer arithmetic with operand types and result range', () => {
            const expr = BinaryOperation.create({
                operator: '+',
                left: util.integerLiteral(4),
                right: util.integerLiteral(2),
                span: util.someCodeSpan,
            })
            const result = expr.toCIRExpression(util.newSemanticContext())
            expect(result.isSuccess || result.error.errors).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                kind: 'ADDITION',
                left: {
                    kind: 'INTEGER_LITERAL',
                    type: { universe: 'integer', value: '4' },
                },
                right: {
                    kind: 'INTEGER_LITERAL',
                    type: { universe: 'integer', value: '2' },
                },
                type: { universe: 'integer', value: '6' },
            })
        })

        it('maps comparison operators to CIR kinds', () => {
            const examples = [
                ['==', 'EQUAL'],
                ['!=', 'NOT_EQUAL'],
                ['<', 'LESS_THAN'],
                ['<=', 'LESS_THAN_OR_EQUAL'],
                ['>', 'GREATER_THAN'],
                ['>=', 'GREATER_THAN_OR_EQUAL'],
            ] as const
            for (const [operator, kind] of examples) {
                const expr = BinaryOperation.create({
                    operator,
                    left: util.integerLiteral(1),
                    right: util.integerLiteral(2),
                    span: util.someCodeSpan,
                })
                const result = expr.toCIRExpression(util.newSemanticContext())
                expect(result.isSuccess || result.error.errors).toBeTrue()
                expect(result.isSuccess && result.value.kind).toBe(kind)
            }
        })
    })
})
