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
        const errorReporter = new TestErrorReporter('test.clawr')
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = DataDeclarationParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            name: 'MyData',
            fields: [
                { name: 'field1', type: 'integer' },
                { name: 'field2', type: 'truthvalue' },
            ],
        })
    })
})
