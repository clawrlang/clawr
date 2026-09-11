import { describe, expect, it } from 'bun:test'
import { TestErrorReporter } from '@@/util'
import { TokenStream } from '@/lexer'
import { DataLiteralParser } from '@/parser/data-literal-parser'

describe('DataLiteralParser', () => {
    it('parses a data literal', () => {
        const code = `
            {
                x: 42
                y: 17
            }`
        const result = parseDataLiteral(code)
        expect(result).toMatchObject({
            fields: [
                { name: 'x', value: { value: { min: 42n, max: 42n } } },
                { name: 'y', value: { value: { min: 17n, max: 17n } } },
            ],
        })
    })

    it('parses a comma-separated data literal', () => {
        const code = '{ x: 42, y: 17 }'
        const result = parseDataLiteral(code)
        expect(result).toMatchObject({
            fields: [
                { name: 'x', value: { value: { min: 42n, max: 42n } } },
                { name: 'y', value: { value: { min: 17n, max: 17n } } },
            ],
        })
    })
})

function parseDataLiteral(code: string) {
    const errorReporter = new TestErrorReporter()
    const tokenStream = TokenStream.read(code, errorReporter)
    const parser = DataLiteralParser.create({ errorReporter })
    return parser.parse(tokenStream)
}
