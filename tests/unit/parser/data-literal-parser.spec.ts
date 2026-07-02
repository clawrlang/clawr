import { describe, expect, it } from 'bun:test'
import { TestErrorReporter } from '../../util'
import { TokenStream } from '../../../src/lexer'
import { DataLiteralParser } from '../../../src/parser/data-literal-parser'
import { ExpressionParser } from '../../../src/parser/expression.parser'

describe('DataLiteralParser', () => {
    it('parses a data literal', () => {
        const code = `
            {
                x: 42
                y: 17
            }`
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = DataLiteralParser.create(
            { errorReporter },
            {
                expressionParser: ExpressionParser.create({ errorReporter }),
            },
        )
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            fields: [
                { name: 'x', value: { value: 42n } },
                { name: 'y', value: { value: 17n } },
            ],
        })
    })

    it('parses a comma-separated data literal', () => {
        const code = '{ x: 42, y: 17 }'
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = DataLiteralParser.create(
            { errorReporter },
            { expressionParser: ExpressionParser.create({ errorReporter }) },
        )
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            fields: [
                { name: 'x', value: { value: 42n } },
                { name: 'y', value: { value: 17n } },
            ],
        })
    })
})
