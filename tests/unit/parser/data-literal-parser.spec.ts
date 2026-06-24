import { describe, expect, it } from 'bun:test'
import { TestErrorReporter } from '../../util'
import { TokenStream } from '../../../src/lexer'
import { DataLiteralParser } from '../../../src/parser/data-literal-parser'

describe('DataLiteralParser', () => {
    it('parses a data literal', () => {
        const code = `
            {
                x: 42
                y: 17
            }`
        const tokenStream = TokenStream.read(
            code,
            new TestErrorReporter('test.clawr'),
        )
        const parser = DataLiteralParser.create()
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            fields: [
                { name: 'x', value: { value: 42n } },
                { name: 'y', value: { value: 17n } },
            ],
        })
    })
})
