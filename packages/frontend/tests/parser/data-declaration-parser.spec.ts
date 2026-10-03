import { TokenStream } from '@/lexer'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { IntegerRange, TruthvalueSet } from '@/model/value-set'
import { DataDeclarationParser } from '@/parser/data-declaration-parser'
import { describe, expect, it } from 'bun:test'

describe('DataDeclarationParser', () => {
    it('parses a data declaration with default-mutability', () => {
        const code = `
            data MyData {
                field1: integer
                field2: truthvalue
            }`
        const result = parseDataDeclaration(code)
        expect(result).toMatchObject({
            name: { name: 'MyData' },
            fields: [
                {
                    name: 'field1',
                    isImmutable: false,
                    isolationLevel: ISOLATED,
                },
                {
                    name: 'field2',
                    isImmutable: false,
                    isolationLevel: ISOLATED,
                },
            ],
        })
        expect(result.fields[0].domain).toBeInstanceOf(IntegerRange)
        expect(result.fields[1].domain).toBeInstanceOf(TruthvalueSet)
    })

    it('parses a data declaration with mixed semantics', () => {
        const code = `
            data MyData {
                ref field1: integer
                const field2: truthvalue
            }`
        const result = parseDataDeclaration(code)
        expect(result).toMatchObject({
            name: { name: 'MyData' },
            fields: [
                {
                    name: 'field1',
                    isImmutable: true,
                    isolationLevel: SHARED,
                },
                {
                    name: 'field2',
                    isImmutable: true,
                    isolationLevel: ISOLATED,
                },
            ],
        })
        expect(result.fields[0].domain).toBeInstanceOf(IntegerRange)
        expect(result.fields[1].domain).toBeInstanceOf(TruthvalueSet)
    })
})

function parseDataDeclaration(code: string) {
    const tokenStream = TokenStream.read(code)
    const parser = DataDeclarationParser.create({})
    return parser.parse(tokenStream)
}
