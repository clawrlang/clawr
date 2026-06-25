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

    it('parses bound reference variable declaration', () => {
        const source = `bound foo: Type = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            semantics: 'bound',
            name: 'foo',
            type: 'Type',
            initialValue: { value: 1n },
        })
    })

    it('parses mutable reference variable declaration', () => {
        const source = `ref foo: Type = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            semantics: 'ref',
            name: 'foo',
            type: 'Type',
            initialValue: { value: 1n },
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
