import { TokenStream } from '@/lexer'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { VariableDeclarationParser } from '@/parser/variable-declaration-parser'
import { describe, expect, it } from 'bun:test'

describe('VariableDeclarationParser', () => {
    it('parses const integer variable declaration', () => {
        const source = `const foo: integer = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            isImmutable: true,
            name: 'foo',
            type: { min: undefined, max: undefined },
            initialValue: { value: { min: 1n, max: 1n } },
        })
    })

    it('parses mutable integer variable declaration', () => {
        const source = `mut foo: integer = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            isImmutable: false,
            name: 'foo',
            type: { min: undefined, max: undefined },
            initialValue: { value: { min: 1n, max: 1n } },
        })
    })

    it('parses mutable reference variable declaration', () => {
        const source = `mut foo: ref Type = { x: 1, y: 2 }`
        expect(parseVariableDeclaration(source)).toMatchObject({
            isImmutable: false,
            name: 'foo',
            isolationLevel: SHARED,
            type: { type: { name: 'Type' } },
            initialValue: {
                properties: [
                    { name: 'x', value: { value: { min: 1n, max: 1n } } },
                    { name: 'y', value: { value: { min: 2n, max: 2n } } },
                ],
            },
        })
    })

    it('parses non-reassignable reference variable declaration', () => {
        const source = `const foo: ref Type = { x: 1, y: 2 }`
        expect(parseVariableDeclaration(source)).toMatchObject({
            isImmutable: true,
            name: 'foo',
            isolationLevel: SHARED,
            type: { type: { name: 'Type' } },
            initialValue: {
                properties: [
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
            initialValue: { value: { min: 1n, max: 1n } },
        })
    })

    it('parses shared data literal', () => {
        const source = 'const r: ref MyData = {}'
        const decl = parseVariableDeclaration(source)

        expect(decl).toMatchObject({
            isImmutable: true,
            name: 'r',
            isolationLevel: SHARED,
            type: { type: { name: 'MyData' } },
            initialValue: { properties: [] },
        })
    })

    it('parses isolated data literal', () => {
        const source = 'const v: cow MyData = {}'
        const decl = parseVariableDeclaration(source)

        expect(decl).toMatchObject({
            isImmutable: true,
            name: 'v',
            isolationLevel: ISOLATED,
            type: { type: { name: 'MyData' } },
            initialValue: { properties: [] },
        })
    })

    it('parses shared copy', () => {
        const source = 'const r = copy(of: x) as ref'
        const decl = parseVariableDeclaration(source)

        expect(decl).toMatchObject({
            name: 'r',
            isolationLevel: SHARED,
        })
    })

    it('parses isolated data literal', () => {
        const source = 'const v = copy(of: x) as cow'
        const decl = parseVariableDeclaration(source)

        expect(decl).toMatchObject({
            name: 'v',
            isolationLevel: ISOLATED,
        })
    })
})

function parseVariableDeclaration(source: string) {
    const tokenStream = TokenStream.read(source)
    const parser = VariableDeclarationParser.create({})
    return parser.parse(tokenStream)
}
