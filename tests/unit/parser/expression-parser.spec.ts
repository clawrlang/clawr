import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { ExpressionParser } from '../../../src/parser'
import {
    Expression,
    IntegerLiteral,
    TruthValueLiteral,
    VariableReference,
} from '../../../src/model'
import { TestErrorReporter } from '../../util'

describe('Expression Parser', () => {
    describe('truthvalue literals', () => {
        const cases = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`parses ${input} as Truthvalue`, () => {
                const literal = parseExpression(input)
                expect(literal).toMatchObject({ value: input })
                expect(literal).toBeInstanceOf(TruthValueLiteral)
            })
        }
    })

    describe('integer literals', () => {
        const cases = ['0', '1', '2', '-1', '123456789'] as const
        for (const input of cases) {
            it(`parses ${input} as Integer`, () => {
                const literal = parseExpression(input)
                expect(literal).toMatchObject({ value: BigInt(input) })
                expect(literal).toBeInstanceOf(IntegerLiteral)
            })
        }
    })

    it('parses variable references', () => {
        const input = 'myVar'
        const variableRef = parseExpression(input)
        expect(variableRef).toMatchObject({ name: input })
        expect(variableRef).toBeInstanceOf(VariableReference)
    })
})

function parseExpression(input: string): Expression {
    const tokenStream = TokenStream.read(
        input,
        new TestErrorReporter('test.clawr'),
    )
    return ExpressionParser.create(tokenStream).parse()
}
