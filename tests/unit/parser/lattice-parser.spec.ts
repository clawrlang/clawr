import { describe, expect, it } from 'bun:test'
import {
    IntegerLattice,
    RCTypeLattice,
    StringLattice,
    TruthvalueLattice,
} from '../../../src/model/lattice'
import { TokenStream } from '../../../src/lexer'
import { LatticeParser } from '../../../src/parser/lattice-parser'
import { TestErrorReporter } from '../../util'

describe('LatticeParser', () => {
    it('parses unconstrained integer type', () => {
        const lattice = parseLattice('integer')
        expect(lattice).toBeInstanceOf(IntegerLattice)
        expect(lattice).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 8 },
            },
        })
    })

    it('parses integer type with min constraint only', () => {
        const lattice = parseLattice('integer(1...)')
        expect(lattice).toBeInstanceOf(IntegerLattice)
        expect(lattice).toMatchObject({
            min: 1n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 14 },
            },
        })
    })

    it('parses integer type with (exclusive) max constraint only', () => {
        const lattice = parseLattice('integer(..<10)')
        expect(lattice).toBeInstanceOf(IntegerLattice)
        expect(lattice).toMatchObject({
            max: 9n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 15 },
            },
        })
    })

    it('parses integer type with (inclusive) max constraint only', () => {
        const lattice = parseLattice('integer(...10)')
        expect(lattice).toBeInstanceOf(IntegerLattice)
        expect(lattice).toMatchObject({
            max: 10n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 15 },
            },
        })
    })

    it('parses integer type with min and (inclusive) max constraints', () => {
        const lattice = parseLattice('integer(1...10)')
        expect(lattice).toBeInstanceOf(IntegerLattice)
        expect(lattice).toMatchObject({
            min: 1n,
            max: 10n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 16 },
            },
        })
    })

    it('parses integer type with min and (exclusive) max constraints', () => {
        const lattice = parseLattice('integer(1..<10)')
        expect(lattice).toBeInstanceOf(IntegerLattice)
        expect(lattice).toMatchObject({
            min: 1n,
            max: 9n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 16 },
            },
        })
    })

    it('parses unconstrained truthvalue type', () => {
        const lattice = parseLattice('truthvalue')
        expect(lattice).toBeInstanceOf(TruthvalueLattice)
        expect(lattice).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 11 },
            },
        })
    })

    it('parses truthvalue type with constraints', () => {
        const lattice = parseLattice('truthvalue(true, false)')
        expect(lattice).toBeInstanceOf(TruthvalueLattice)
        expect(lattice).toMatchObject({
            values: ['true', 'false'],
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 24 },
            },
        })
    })

    it('parses unconstrained string type', () => {
        const lattice = parseLattice('string')
        expect(lattice).toBeInstanceOf(StringLattice)
        expect(lattice).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 7 },
            },
        })
    })

    it('parses rc-types', () => {
        const lattice = parseLattice('MyType')
        expect(lattice).toBeInstanceOf(RCTypeLattice)
        expect(lattice).toMatchObject({
            type: { name: 'MyType' },
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 7 },
            },
        })
    })
})

function parseLattice(input: string) {
    const errorReporter = new TestErrorReporter()
    const stream = TokenStream.read(input, errorReporter)
    const parser = LatticeParser.create({ errorReporter })
    return parser.parse(stream)
}
