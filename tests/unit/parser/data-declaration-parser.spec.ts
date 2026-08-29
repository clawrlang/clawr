import { describe, expect, it } from 'bun:test'
import { TokenStream } from '@/lexer'
import { TestErrorReporter } from '@@/util'
import { DataDeclarationParser } from '@/parser/data-declaration-parser'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { IntegerLattice, TruthvalueLattice } from '@/model/lattice'

describe('DataDeclarationParser', () => {
    it('parses a data declaration with default-mutability', () => {
        const code = `
            data MyData {
                field1: integer
                field2: truthvalue
            }`
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = DataDeclarationParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
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
        expect(result.fields[0].lattice).toBeInstanceOf(IntegerLattice)
        expect(result.fields[1].lattice).toBeInstanceOf(TruthvalueLattice)
    })

    it('parses a data declaration with mixed semantics', () => {
        const code = `
            data MyData {
                ref field1: integer
                const field2: truthvalue
            }`
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = DataDeclarationParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
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
        expect(result.fields[0].lattice).toBeInstanceOf(IntegerLattice)
        expect(result.fields[1].lattice).toBeInstanceOf(TruthvalueLattice)
    })
})
