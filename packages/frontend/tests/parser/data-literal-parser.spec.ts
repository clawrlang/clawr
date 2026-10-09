import { TokenStream } from '@/lexer'
import { DataLiteralParser } from '@/parser/literals'
import { describe, expect, it } from 'bun:test'

describe('DataLiteralParser', () => {
    it('parses a data literal', () => {
        const code = `
            {
                x: 42
                y: 17
            }`
        const result = parseDataLiteral(code)
        expect(result).toMatchObject({
            properties: [
                { name: 'x', value: { value: { min: 42n, max: 42n } } },
                { name: 'y', value: { value: { min: 17n, max: 17n } } },
            ],
        })
    })

    it('parses a comma-separated data literal', () => {
        const code = '{ x: 42, y: 17 }'
        const result = parseDataLiteral(code)
        expect(result).toMatchObject({
            properties: [
                { name: 'x', value: { value: { min: 42n, max: 42n } } },
                { name: 'y', value: { value: { min: 17n, max: 17n } } },
            ],
        })
    })

    it('parses an initializer call', () => {
        const code = '{ Super.setup() }'
        const result = parseDataLiteral(code)
        expect(result).toMatchObject({
            initializerCall: {
                name: {
                    baseName: 'setup',
                    arity: 0,
                    labels: [],
                },
                arguments: [],
                recipient: { name: 'Super' },
            },
        })
    })
})

function parseDataLiteral(code: string) {
    const tokenStream = TokenStream.read(code)
    const parser = DataLiteralParser.create({})
    return parser.parse(tokenStream)
}
