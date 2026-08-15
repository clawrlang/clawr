import { describe, expect, it } from 'bun:test'
import {
    IntegerLattice,
    RCTypeLattice,
    StringLattice,
    TruthvalueLattice,
} from '../../../src/model/lattice'
import { TokenStream } from '../../../src/lexer'
import { ValueSetParser } from '../../../src/parser/value-set-parser'
import { TestErrorReporter } from '../../util'
import { ISOLATED } from '../../../src/model/isolation-level'

describe('ValueSetParser', () => {
    it('parses unconstrained integer type', () => {
        const valueSet = parseValueSet('integer')
        expect(valueSet.lattice).toBeInstanceOf(IntegerLattice)
        expect(valueSet).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 8 },
            },
        })
    })

    it('parses integer type with min constraint only', () => {
        const valueSet = parseValueSet('integer(1...)')
        expect(valueSet.lattice).toBeInstanceOf(IntegerLattice)
        expect(valueSet).toMatchObject({
            lattice: { min: 1n },
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 14 },
            },
        })
    })

    it('parses integer type with (exclusive) max constraint only', () => {
        const valueSet = parseValueSet('integer(..<10)')
        expect(valueSet.lattice).toBeInstanceOf(IntegerLattice)
        expect(valueSet).toMatchObject({
            lattice: { max: 9n },
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 15 },
            },
        })
    })

    it('parses integer type with (inclusive) max constraint only', () => {
        const valueSet = parseValueSet('integer(...10)')
        expect(valueSet.lattice).toBeInstanceOf(IntegerLattice)
        expect(valueSet).toMatchObject({
            lattice: { max: 10n },
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 15 },
            },
        })
    })

    it('parses integer type with min and (inclusive) max constraints', () => {
        const valueSet = parseValueSet('integer(1...10)')
        expect(valueSet.lattice).toBeInstanceOf(IntegerLattice)
        expect(valueSet).toMatchObject({
            lattice: { min: 1n, max: 10n },
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 16 },
            },
        })
    })

    it('parses integer type with min and (exclusive) max constraints', () => {
        const valueSet = parseValueSet('integer(1..<10)')
        expect(valueSet.lattice).toBeInstanceOf(IntegerLattice)
        expect(valueSet).toMatchObject({
            lattice: { min: 1n, max: 9n },
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 16 },
            },
        })
    })

    it('parses unconstrained truthvalue type', () => {
        const valueSet = parseValueSet('truthvalue')
        expect(valueSet.lattice).toBeInstanceOf(TruthvalueLattice)
        expect(valueSet).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 11 },
            },
        })
    })

    it('parses truthvalue type with constraints', () => {
        const valueSet = parseValueSet('truthvalue(true, false)')
        expect(valueSet.lattice).toBeInstanceOf(TruthvalueLattice)
        expect(valueSet).toMatchObject({
            lattice: { values: ['true', 'false'] },
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 24 },
            },
        })
    })

    it('parses unconstrained string type', () => {
        const valueSet = parseValueSet('string')
        expect(valueSet.lattice).toBeInstanceOf(StringLattice)
        expect(valueSet).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 7 },
            },
        })
    })

    it('parses rc-types', () => {
        const valueSet = parseValueSet('MyType')
        expect(valueSet.lattice).toBeInstanceOf(RCTypeLattice)
        expect(valueSet).toMatchObject({
            lattice: { type: { name: 'MyType' } },
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 7 },
            },
        })
    })
})

function parseValueSet(input: string) {
    const errorReporter = new TestErrorReporter()
    const stream = TokenStream.read(input, errorReporter)
    const parser = ValueSetParser.create({ errorReporter })
    return parser.parse(stream, ISOLATED)
}
