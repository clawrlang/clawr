import { describe, expect, it } from 'bun:test'
import { ErrorReporter, SourceCodeSpan } from '../../../src/diagnostics'
import { TokenStream } from '../../../src/lexer'
import { ExpressionParser } from '../../../src/parser'
import { Expression } from '../../../src/model'

describe('Expression Parser', () => {
    describe('truthvalue literals', () => {
        const cases: Truthvalue[] = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`parses ${input} as Truthvalue`, () => {
                const literal = parseLiteral(input)
                expect(literal).toMatchObject({ value: input })
            })
        }
    })

    describe('integer literals', () => {
        const cases = ['0', '1', '2', '-1', '123456789'] as const
        for (const input of cases) {
            it(`parses ${input} as Integer`, () => {
                const literal = parseLiteral(input)
                expect(literal).toMatchObject({ value: BigInt(input) })
            })
        }
    })
})

function parseLiteral(input: string): Expression {
    const tokenStream = TokenStream.read(input, new TestErrorReporter())
    return ExpressionParser.create(tokenStream).parse()
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

type Truthvalue = 'true' | 'false' | 'ambiguous'
