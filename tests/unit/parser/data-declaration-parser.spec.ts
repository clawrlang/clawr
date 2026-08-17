import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { TestErrorReporter } from '../../util'
import { DataDeclarationParser } from '../../../src/parser/data-declaration-parser'
import { ISOLATED, SHARED } from '../../../src/model/isolation-level'
import { IntegerLattice, TruthvalueLattice } from '../../../src/model/lattice'

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
                    valueSet: { isolationLevel: ISOLATED },
                },
                {
                    name: 'field2',
                    isImmutable: false,
                    valueSet: { isolationLevel: ISOLATED },
                },
            ],
        })
        expect(result.fields[0].valueSet.lattice).toBeInstanceOf(IntegerLattice)
        expect(result.fields[1].valueSet.lattice).toBeInstanceOf(
            TruthvalueLattice,
        )
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
                    valueSet: { isolationLevel: SHARED },
                },
                {
                    name: 'field2',
                    isImmutable: true,
                    valueSet: { isolationLevel: ISOLATED },
                },
            ],
        })
        expect(result.fields[0].valueSet.lattice).toBeInstanceOf(IntegerLattice)
        expect(result.fields[1].valueSet.lattice).toBeInstanceOf(
            TruthvalueLattice,
        )
    })
})
