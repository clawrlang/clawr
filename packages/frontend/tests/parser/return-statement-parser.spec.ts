import { TokenStream } from '@/lexer'
import { ReturnStatementParser } from '@/parser/return-statement-parser'
import { describe, expect, it } from 'bun:test'

describe('Return Statement Parser', () => {
    it('parses a return statement with an expression', () => {
        const code = 'return 42\n'
        const result = parseReturnStatement(code)
        expect(result).toMatchObject({
            value: { value: { min: 42n, max: 42n } },
        })
    })

    it('parses a return statement without an expression', () => {
        const code = 'return\n'
        const result = parseReturnStatement(code)
        expect(result).toMatchObject({
            value: undefined,
        })
    })
})

function parseReturnStatement(code: string) {
    const tokenStream = TokenStream.read(code)
    const parser = ReturnStatementParser.create({})
    return parser.parse(tokenStream)
}
