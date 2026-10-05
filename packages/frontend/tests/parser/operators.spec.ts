import { TokenStream } from '@/lexer'
import { Expression } from '@/model'
import { BinaryOperation } from '@/model/binary-operation'
import { ExpressionParser } from '@/parser/expression-parser'
import { describe, expect, it, test } from 'bun:test'

describe('Expression Parser (Operators)', () => {
    describe('Exponentials', () => {
        it('parses simple exponential expression', () => {
            const expr = parseExpression('2^3')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: { value: { min: 2n, max: 2n } },
                operator: '^',
                right: { value: { min: 3n, max: 3n } },
            })
        })

        it('is right associative', () => {
            const expr = parseExpression('2^3^4')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: { value: { min: 2n, max: 2n } },
                operator: '^',
                right: {
                    left: { value: { min: 3n, max: 3n } },
                    operator: '^',
                    right: { value: { min: 4n, max: 4n } },
                },
            })
        })
    })

    describe('Multiplicative', () => {
        it('parses simple multiplication', () => {
            const expr = parseExpression('2*3')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: { value: { min: 2n, max: 2n } },
                operator: '*',
                right: { value: { min: 3n, max: 3n } },
            })
        })

        it('parses simple division', () => {
            const expr = parseExpression('2/3')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: { value: { min: 2n, max: 2n } },
                operator: '/',
                right: { value: { min: 3n, max: 3n } },
            })
        })

        it('parses simple modulus', () => {
            const expr = parseExpression('2%3')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: { value: { min: 2n, max: 2n } },
                operator: '%',
                right: { value: { min: 3n, max: 3n } },
            })
        })

        it('is preceded by exponentiation', () => {
            const expr = parseExpression('2^3*3^4')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: {
                    left: { value: { min: 2n, max: 2n } },
                    operator: '^',
                    right: { value: { min: 3n, max: 3n } },
                },
                operator: '*',
                right: {
                    left: { value: { min: 3n, max: 3n } },
                    operator: '^',
                    right: { value: { min: 4n, max: 4n } },
                },
            })
        })

        it('is left associative', () => {
            const expr = parseExpression('2*3/4')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: {
                    left: { value: { min: 2n, max: 2n } },
                    operator: '*',
                    right: { value: { min: 3n, max: 3n } },
                },
                operator: '/',
                right: { value: { min: 4n, max: 4n } },
            })
        })
    })

    describe('Additive', () => {
        it('parses simple addition', () => {
            const expr = parseExpression('2+3')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: { value: { min: 2n, max: 2n } },
                operator: '+',
                right: { value: { min: 3n, max: 3n } },
            })
        })

        it('parses simple subtraction', () => {
            const expr = parseExpression('2-3')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: { value: { min: 2n, max: 2n } },
                operator: '-',
                right: { value: { min: 3n, max: 3n } },
            })
        })

        it('is preceded by muliplication', () => {
            const expr = parseExpression('2*3+3*4')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: {
                    left: { value: { min: 2n, max: 2n } },
                    operator: '*',
                    right: { value: { min: 3n, max: 3n } },
                },
                operator: '+',
                right: {
                    left: { value: { min: 3n, max: 3n } },
                    operator: '*',
                    right: { value: { min: 4n, max: 4n } },
                },
            })
        })

        it('is left associative', () => {
            const expr = parseExpression('2+3-4')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: {
                    left: { value: { min: 2n, max: 2n } },
                    operator: '+',
                    right: { value: { min: 3n, max: 3n } },
                },
                operator: '-',
                right: { value: { min: 4n, max: 4n } },
            })
        })
    })

    describe('Comparison', () => {
        describe('parses simple comparison', () => {
            const operators = ['==', '!=', '===', '!==']
            for (const operator of operators)
                test(operator, () => {
                    const expr = parseExpression(`2 ${operator} 3`)
                    expect(expr).toBeInstanceOf(BinaryOperation)
                    expect(expr).toMatchObject({
                        left: { value: { min: 2n, max: 2n } },
                        operator,
                        right: { value: { min: 3n, max: 3n } },
                    })
                })
        })

        it('is preceded by addition', () => {
            const expr = parseExpression('2+3 == 3+4')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: {
                    left: { value: { min: 2n, max: 2n } },
                    operator: '+',
                    right: { value: { min: 3n, max: 3n } },
                },
                operator: '==',
                right: {
                    left: { value: { min: 3n, max: 3n } },
                    operator: '+',
                    right: { value: { min: 4n, max: 4n } },
                },
            })
        })

        it('is non-associative', () => {
            const tokenStream = TokenStream.read('2 == 3 == 4')
            ExpressionParser.create({}).parse(tokenStream)
            expect(tokenStream.peek()?.kind).toEqual('OPERATOR')
        })
    })

    describe('Logical AND', () => {
        it('parses simple AND', () => {
            const expr = parseExpression('true && false')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: { value: { values: ['true'] } },
                operator: '&&',
                right: { value: { values: ['false'] } },
            })
        })

        it('is preceded by comparison', () => {
            const expr = parseExpression(
                'true == ambiguous && ambiguous == false',
            )
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: {
                    left: { value: { values: ['true'] } },
                    operator: '==',
                    right: { value: { values: ['ambiguous'] } },
                },
                operator: '&&',
                right: {
                    left: { value: { values: ['ambiguous'] } },
                    operator: '==',
                    right: { value: { values: ['false'] } },
                },
            })
        })

        it('is left associative', () => {
            const expr = parseExpression('true && false && ambiguous')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: {
                    left: { value: { values: ['true'] } },
                    operator: '&&',
                    right: { value: { values: ['false'] } },
                },
                operator: '&&',
                right: { value: { values: ['ambiguous'] } },
            })
        })
    })

    describe('Logical OR', () => {
        it('parses simple OR', () => {
            const expr = parseExpression('true || false')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: { value: { values: ['true'] } },
                operator: '||',
                right: { value: { values: ['false'] } },
            })
        })

        it('is preceded by AND', () => {
            const expr = parseExpression(
                'true && ambiguous || ambiguous && false',
            )
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: {
                    left: { value: { values: ['true'] } },
                    operator: '&&',
                    right: { value: { values: ['ambiguous'] } },
                },
                operator: '||',
                right: {
                    left: { value: { values: ['ambiguous'] } },
                    operator: '&&',
                    right: { value: { values: ['false'] } },
                },
            })
        })

        it('is left associative', () => {
            const expr = parseExpression('true || false || ambiguous')
            expect(expr).toBeInstanceOf(BinaryOperation)
            expect(expr).toMatchObject({
                left: {
                    left: { value: { values: ['true'] } },
                    operator: '||',
                    right: { value: { values: ['false'] } },
                },
                operator: '||',
                right: { value: { values: ['ambiguous'] } },
            })
        })
    })
})

function parseExpression(input: string): Expression {
    const tokenStream = TokenStream.read(input)
    return ExpressionParser.create({}).parse(tokenStream)
}
