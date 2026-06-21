import { describe, expect, it } from 'bun:test'
import { Expression } from '../../../src/cir'
import { ErrorReporter, SourceCodeSpan } from '../../../src/diagnostics'
import { TokenStream } from '../../../src/lexer'
import { TruthvalueLiteralParser } from '../../../src/parser'

describe('Literal Parsing', () => {
    describe('truthvalue literals', () => {
        const cases: Truthvalue[] = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`parses ${input} as Truthvalue`, () => {
                const tokenStream = TokenStream.read(
                    input,
                    new TestErrorReporter(),
                )
                const parser = TruthvalueLiteralParser.create(tokenStream)
                const literal = parser.parse()
                expect(literal).toMatchObject({
                    type: 'TRUTHVALUE_LITERAL',
                    value: input,
                })
            })
        }
    })
})

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
