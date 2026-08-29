import { describe, expect, it } from 'bun:test'
import { TokenStream } from '@/lexer'
import { VariableDeclarationParser } from '@/parser/variable-declaration-parser'
import { TestErrorReporter } from '@@/util'
import { ISOLATED, SHARED } from '@/model/isolation-level'

describe('VariableDeclarationParser', () => {
    it('parses const integer variable declaration', () => {
        const source = `const foo: integer = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            isImmutable: true,
            name: 'foo',
            lattice: { min: undefined, max: undefined },
            initialValue: { value: { min: 1n, max: 1n } },
        })
    })

    it('parses mutable integer variable declaration', () => {
        const source = `mut foo: integer = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            isImmutable: false,
            name: 'foo',
            lattice: { min: undefined, max: undefined },
            initialValue: { value: { min: 1n, max: 1n } },
        })
    })

    it('parses mutable reference variable declaration', () => {
        const source = `mutref foo: Type = { x: 1, y: 2 }`
        expect(parseVariableDeclaration(source)).toMatchObject({
            isImmutable: false,
            name: 'foo',
            isolationLevel: SHARED,
            lattice: { type: { name: 'Type' } },
            initialValue: {
                fields: [
                    { name: 'x', value: { value: { min: 1n, max: 1n } } },
                    { name: 'y', value: { value: { min: 2n, max: 2n } } },
                ],
            },
        })
    })

    it('parses non-reassignable reference variable declaration', () => {
        const source = `ref foo: Type = { x: 1, y: 2 }`
        expect(parseVariableDeclaration(source)).toMatchObject({
            isImmutable: true,
            name: 'foo',
            isolationLevel: SHARED,
            lattice: { type: { name: 'Type' } },
            initialValue: {
                fields: [
                    { name: 'x', value: { value: { min: 1n, max: 1n } } },
                    { name: 'y', value: { value: { min: 2n, max: 2n } } },
                ],
            },
        })
    })

    it('parses variable declaration with inferred type', () => {
        const source = `const foo = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            isImmutable: true,
            name: 'foo',
            isolationLevel: ISOLATED,
            initialValue: { value: { min: 1n, max: 1n } },
        })
    })

    it('sets the isolation-level of data literal', () => {
        const source = 'ref r: MyData = {}'
        const decl = parseVariableDeclaration(source)

        expect(decl).toMatchObject({
            isImmutable: true,
            name: 'r',
            isolationLevel: SHARED,
            lattice: { type: { name: 'MyData' } },
            initialValue: { fields: [] },
        })
    })
})

function parseVariableDeclaration(source: string) {
    const errorReporter = new TestErrorReporter()
    const tokenStream = TokenStream.read(source, errorReporter)
    const parser = VariableDeclarationParser.create({ errorReporter })
    const decl = parser.parse(tokenStream)
    return decl
}
