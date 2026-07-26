import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { VariableDeclarationParser } from '../../../src/parser/variable-declaration-parser'
import { newSemanticContext, TestErrorReporter } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { ExplicitRCTypeValueSet } from '../../../src/model/explicit-value-set'

describe('VariableDeclarationParser', () => {
    it('parses const integer variable declaration', () => {
        const source = `const foo: integer = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            semantics: 'const',
            name: 'foo',
            valueSet: {
                min: undefined,
                max: undefined,
            },
            initialValue: { value: 1n },
        })
    })

    it('parses mutable integer variable declaration', () => {
        const source = `mut foo: integer = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            semantics: 'mut',
            name: 'foo',
            valueSet: {
                min: undefined,
                max: undefined,
            },
            initialValue: { value: 1n },
        })
    })

    it('parses mutable reference variable declaration', () => {
        const source = `mutref foo: Type = { x: 1, y: 2 }`
        expect(parseVariableDeclaration(source)).toMatchObject({
            semantics: 'mutref',
            name: 'foo',
            valueSet: { typeName: 'Type' },
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
            valueSet: { typeName: 'Type' },
            initialValue: {
                fields: [
                    { name: 'x', value: { value: 1n } },
                    { name: 'y', value: { value: 2n } },
                ],
            },
        })
    })

    it('parses variable declaration with inferred type', () => {
        const source = `const foo = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            semantics: 'const',
            name: 'foo',
            valueSet: undefined,
            initialValue: { value: 1n },
        })
    })

    it('sets the semantics of data literal', () => {
        const context = newSemanticContext()
        context.scope.rootScope.declarations.set(
            'MyData',
            DataDeclaration.create({
                name: 'MyData',
                fields: [],
            }),
        )

        const source = 'ref r: MyData = {}'
        const decl = parseVariableDeclaration(source)

        expect(decl).toMatchObject({
            semantics: 'ref',
            name: 'r',
            valueSet: {
                typeName: 'MyData',
            },
            initialValue: { fields: [] },
        })
        expect((decl as any).valueSet).toBeInstanceOf(ExplicitRCTypeValueSet)
        expect((decl as any).valueSet.semantics).toBe('ref')
    })
})

function parseVariableDeclaration(source: string) {
    const errorReporter = new TestErrorReporter()
    const tokenStream = TokenStream.read(source, errorReporter)
    const parser = VariableDeclarationParser.create({ errorReporter })
    const decl = parser.parse(tokenStream)
    return decl
}
