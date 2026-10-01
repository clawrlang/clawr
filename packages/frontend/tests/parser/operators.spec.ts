import { TokenStream } from '@/lexer'
import { Expression } from '@/model'
import { Exponential } from '@/model/exponential'
import { ExpressionParser } from '@/parser/expression-parser'
import { TestErrorReporter } from '@@/util'
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
})

function parseExpression(input: string): Expression {
    const errorReporter = new TestErrorReporter()
    const tokenStream = TokenStream.read(input, errorReporter)
    return ExpressionParser.create({
        errorReporter,
    }).parse(tokenStream)
}
