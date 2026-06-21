import { describe, expect, it } from 'bun:test'
import { Expression } from '../../../src/cir'
import { ErrorReporter, SourceCodeSpan } from '../../../src/diagnostics'
import { TokenStream } from '../../../src/lexer'
import {
    ExpressionParser,
    IntegerLiteralParser,
    TruthvalueLiteralParser,
} from '../../../src/parser'

describe('Literal Parsing', () => {
    describe('truthvalue literals', () => {
        const cases: Truthvalue[] = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`parses ${input} as Truthvalue`, () => {
                const literal = parseLiteral(
                    input,
                    TruthvalueLiteralParser.create,
                )
                expect(literal).toMatchObject({
                    type: 'TRUTHVALUE_LITERAL',
                    value: input,
                })
            })
        }
    })

    describe('integer literals', () => {
        const cases = ['0', '1', '2', '-1', '123456789'] as const
        for (const input of cases) {
            it(`parses ${input} as Integer`, () => {
                const literal = parseLiteral(input, IntegerLiteralParser.create)
                expect(literal).toMatchObject({
                    type: 'INTEGER_LITERAL',
                    value: input,
                })
            })
        }
    })
})

function parseLiteral(
    input: string,
    parserFactory: (tokenStream: TokenStream) => ExpressionParser,
): Expression {
    const tokenStream = TokenStream.read(input, new TestErrorReporter())
    const parser = parserFactory(tokenStream)
    return parser.parse()
}

class TestErrorReporter implements ErrorReporter {
    reportFatalError(message: string, location: SourceCodeSpan): never {
        throw new Error('Method not implemented.')
    }
    reportWarning(message: string, location: SourceCodeSpan): void {
        throw new Error('Method not implemented.')
    }
    reportError(message: string, location: SourceCodeSpan): void {
        throw new Error('Method not implemented.')
    }
}

type Truthvalue = Extract<Expression, { type: 'TRUTHVALUE_LITERAL' }>['value']
