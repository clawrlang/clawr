import { TokenStream } from '@/lexer'
import { Expression } from '@/model'
import { Addition } from '@/model/addition'
import { Division } from '@/model/division'
import { Exponential } from '@/model/exponential'
import { Modulus } from '@/model/modulus'
import { Multiplication } from '@/model/multiplication'
import { Subtraction } from '@/model/subtraction'
import { ExpressionParser } from '@/parser/expression-parser'
import { describe, expect, it } from 'bun:test'

describe('Expression Parser (Operators)', () => {
    describe('Exponentials', () => {
        it('parses simple exponential expression', () => {
            const expr = parseExpression('2^3')
            expect(expr).toBeInstanceOf(Exponential)
            expect(expr).toMatchObject({
                base: { value: { min: 2n, max: 2n } },
                exponent: { value: { min: 3n, max: 3n } },
            })
        })

        it('is right associative', () => {
            const expr = parseExpression('2^3^4')
            expect(expr).toBeInstanceOf(Exponential)
            expect(expr).toMatchObject({
                base: { value: { min: 2n, max: 2n } },
                exponent: {
                    base: { value: { min: 3n, max: 3n } },
                    exponent: { value: { min: 4n, max: 4n } },
                },
            })
        })
    })

    describe('Multiplicative', () => {
        it('parses simple multiplication', () => {
            const expr = parseExpression('2*3')
            expect(expr).toBeInstanceOf(Multiplication)
            expect(expr).toMatchObject({
                left: { value: { min: 2n, max: 2n } },
                right: { value: { min: 3n, max: 3n } },
            })
        })

        it('parses simple division', () => {
            const expr = parseExpression('2/3')
            expect(expr).toBeInstanceOf(Division)
            expect(expr).toMatchObject({
                dividend: { value: { min: 2n, max: 2n } },
                divisor: { value: { min: 3n, max: 3n } },
            })
        })

        it('parses simple modulus', () => {
            const expr = parseExpression('2%3')
            expect(expr).toBeInstanceOf(Modulus)
            expect(expr).toMatchObject({
                dividend: { value: { min: 2n, max: 2n } },
                divisor: { value: { min: 3n, max: 3n } },
            })
        })

        it('is preceded by exponentiation', () => {
            const expr = parseExpression('2^3*3^4')
            expect(expr).toBeInstanceOf(Multiplication)
            expect(expr).toMatchObject({
                left: {
                    base: { value: { min: 2n, max: 2n } },
                    exponent: { value: { min: 3n, max: 3n } },
                },
                right: {
                    base: { value: { min: 3n, max: 3n } },
                    exponent: { value: { min: 4n, max: 4n } },
                },
            })
        })

        it('is left associative', () => {
            const expr = parseExpression('2*3/4')
            expect(expr).toBeInstanceOf(Division)
            expect(expr).toMatchObject({
                dividend: {
                    left: { value: { min: 2n, max: 2n } },
                    right: { value: { min: 3n, max: 3n } },
                },
                divisor: { value: { min: 4n, max: 4n } },
            })
        })
    })

    describe('Additive', () => {
        it('parses simple addition', () => {
            const expr = parseExpression('2+3')
            expect(expr).toBeInstanceOf(Addition)
            expect(expr).toMatchObject({
                left: { value: { min: 2n, max: 2n } },
                right: { value: { min: 3n, max: 3n } },
            })
        })

        it('parses simple subtraction', () => {
            const expr = parseExpression('2-3')
            expect(expr).toBeInstanceOf(Subtraction)
            expect(expr).toMatchObject({
                minuend: { value: { min: 2n, max: 2n } },
                subtrahend: { value: { min: 3n, max: 3n } },
            })
        })

        it('is preceded by muliplication', () => {
            const expr = parseExpression('2*3+3*4')
            expect(expr).toBeInstanceOf(Addition)
            expect(expr).toMatchObject({
                left: {
                    left: { value: { min: 2n, max: 2n } },
                    right: { value: { min: 3n, max: 3n } },
                },
                right: {
                    left: { value: { min: 3n, max: 3n } },
                    right: { value: { min: 4n, max: 4n } },
                },
            })
        })

        it('is left associative', () => {
            const expr = parseExpression('2+3-4')
            expect(expr).toBeInstanceOf(Subtraction)
            expect(expr).toMatchObject({
                minuend: {
                    left: { value: { min: 2n, max: 2n } },
                    right: { value: { min: 3n, max: 3n } },
                },
                subtrahend: { value: { min: 4n, max: 4n } },
            })
        })
    })
})

function parseExpression(input: string): Expression {
    const tokenStream = TokenStream.read(input)
    return ExpressionParser.create({}).parse(tokenStream)
}
