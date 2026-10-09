import { TokenStream } from '@/lexer'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { IntegerRange, TruthvalueSet } from '@/model/value-set'
import { DataDeclarationParser } from '@/parser/data-declaration-parser'
import { describe, expect, it } from 'bun:test'

describe('DataDeclarationParser', () => {
    it('parses a data declaration with default-mutability', () => {
        const code = `
            data MyData {
                property1: integer
                property2: truthvalue
            }`
        const result = parseDataDeclaration(code)
        expect(result).toMatchObject({
            name: { name: 'MyData' },
            properties: [
                {
                    name: 'property1',
                    isImmutable: false,
                    isolationLevel: ISOLATED,
                },
                {
                    name: 'property2',
                    isImmutable: false,
                    isolationLevel: ISOLATED,
                },
            ],
        })
        expect(result.properties[0].domain).toBeInstanceOf(IntegerRange)
        expect(result.properties[1].domain).toBeInstanceOf(TruthvalueSet)
    })

    it('parses a data declaration with mixed semantics', () => {
        const code = `
            data MyData {
                ref property1: integer
                const property2: truthvalue
            }`
        const result = parseDataDeclaration(code)
        expect(result).toMatchObject({
            name: { name: 'MyData' },
            properties: [
                {
                    name: 'property1',
                    isImmutable: true,
                    isolationLevel: SHARED,
                },
                {
                    name: 'property2',
                    isImmutable: true,
                    isolationLevel: ISOLATED,
                },
            ],
        })
        expect(result.properties[0].domain).toBeInstanceOf(IntegerRange)
        expect(result.properties[1].domain).toBeInstanceOf(TruthvalueSet)
    })
})

function parseDataDeclaration(code: string) {
    const tokenStream = TokenStream.read(code)
    const parser = DataDeclarationParser.create({})
    return parser.parse(tokenStream)
}
