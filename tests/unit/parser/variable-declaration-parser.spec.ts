import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { VariableDeclarationParser } from '../../../src/parser/variable-declaration-parser'
import { newSemanticContext, TestErrorReporter } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { ExplicitRCTypeValueSet } from '../../../src/model/explicit-value-set'
import { TypeName } from '../../../src/model/type-name'

describe('VariableDeclarationParser', () => {
    it('parses const integer variable declaration', () => {
        const source = `const foo: integer = 1;`
        expect(parseVariableDeclaration(source)).toMatchObject({
            isImmutable: true,
            isolationLevel: 'ISOLATED',
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
            isImmutable: false,
            isolationLevel: 'ISOLATED',
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
            isImmutable: false,
            isolationLevel: 'SHARED',
            name: 'foo',
            valueSet: { type: { name: 'Type' } },
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
            isImmutable: true,
            isolationLevel: 'SHARED',
            name: 'foo',
            valueSet: { type: { name: 'Type' } },
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
            isImmutable: true,
            isolationLevel: 'ISOLATED',
            name: 'foo',
            valueSet: undefined,
            initialValue: { value: 1n },
        })
    })

    it('sets the isolation-level of data literal', () => {
        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            TypeName.create({ name: 'MyType' }),
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [],
            }),
        )

        const source = 'ref r: MyData = {}'
        const decl = parseVariableDeclaration(source)

        expect(decl).toMatchObject({
            isImmutable: true,
            isolationLevel: 'SHARED',
            name: 'r',
            valueSet: { type: { name: 'MyData' } },
            initialValue: { fields: [] },
        })
        expect((decl as any).valueSet).toBeInstanceOf(ExplicitRCTypeValueSet)
    })
})

function parseVariableDeclaration(source: string) {
    const errorReporter = new TestErrorReporter()
    const tokenStream = TokenStream.read(source, errorReporter)
    const parser = VariableDeclarationParser.create({ errorReporter })
    const decl = parser.parse(tokenStream)
    return decl
}
