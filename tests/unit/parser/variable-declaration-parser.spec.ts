import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { VariableDeclarationParser } from '../../../src/parser/variable-declaration-parser'
import { TestErrorReporter } from '../../util'

describe('VariableDeclarationParser', () => {
    it('parses const integer variable declaration', () => {
        const source = `const foo: integer = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            semantics: 'const',
            name: 'foo',
            type: 'integer',
            initialValue: { value: 1n },
        })
    })

    it('parses mutable integer variable declaration', () => {
        const source = `mut foo: integer = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            semantics: 'mut',
            name: 'foo',
            type: 'integer',
            initialValue: { value: 1n },
        })
    })
})

function parseVariableDeclaration(source: string) {
    const tokenStream = TokenStream.read(source, new TestErrorReporter('test'))
    const parser = VariableDeclarationParser.create()
    const decl = parser.parse(tokenStream)
    return decl
}
