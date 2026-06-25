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

    it('parses mutable reference variable declaration', () => {
        const source = `mutref foo: Type = { x: 1, y: 2 }`
        expect(parseVariableDeclaration(source)).toMatchObject({
            semantics: 'mutref',
            name: 'foo',
            type: 'Type',
            initialValue: {
                fields: [
                    { name: 'x', value: { value: 1n } },
                    { name: 'y', value: { value: 2n } },
                ],
            },
        })
    })

    it('parses non-reassignable reference variable declaration', () => {
        const source = `ref foo: Type = { x: 1, y: 2 }`
        expect(parseVariableDeclaration(source)).toMatchObject({
            semantics: 'ref',
            name: 'foo',
            type: 'Type',
            initialValue: {
                fields: [
                    { name: 'x', value: { value: 1n } },
                    { name: 'y', value: { value: 2n } },
                ],
            },
        })
    })
})

function parseVariableDeclaration(source: string) {
    const errorReporter = new TestErrorReporter('test')
    const tokenStream = TokenStream.read(source, errorReporter)
    const parser = VariableDeclarationParser.create({ errorReporter })
    const decl = parser.parse(tokenStream)
    return decl
}
