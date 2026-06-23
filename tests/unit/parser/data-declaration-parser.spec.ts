import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { TestErrorReporter } from '../../util'
import { DataDeclarationParser } from '../../../src/parser/data-declaration-parser'

describe('DataDeclarationParser', () => {
    it('parses a data declaration', () => {
        const code = `
            data MyData {
                field1: integer
                field2: truthvalue
            }`
        const tokenStream = TokenStream.read(
            code,
            new TestErrorReporter('test.clawr'),
        )
        const parser = DataDeclarationParser.create({ tokenStream })
        const result = parser.parse()
        expect(result).toMatchObject({
            name: 'MyData',
            fields: [
                { name: 'field1', type: 'integer' },
                { name: 'field2', type: 'truthvalue' },
            ],
        })
    })
})
