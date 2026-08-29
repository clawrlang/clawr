import { describe, expect, it } from 'bun:test'
import { TestErrorReporter } from '@@/util'
import { TokenStream } from '@/lexer'
import { ReturnStatementParser } from '@/parser/return-statement-parser'

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
    const errorReporter = new TestErrorReporter()
    const tokenStream = TokenStream.read(code, errorReporter)
    const parser = ReturnStatementParser.create({ errorReporter })
    return parser.parse(tokenStream)
}
