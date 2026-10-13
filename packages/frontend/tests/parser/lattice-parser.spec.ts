import { TokenStream } from '@/lexer'
import {
    IntegerSet,
    RCTypeSet,
    StringSet,
    TruthvalueSet,
} from '@/model/value-set'
import { TypeConstraintParser } from '@/parser/type-constraint-parser'
import { describe, expect, it } from 'bun:test'

describe('TypeConstraintParser', () => {
    it('parses unconstrained integer type', () => {
        const type = parseTypeConsstraint('integer')
        expect(type).toBeInstanceOf(IntegerSet)
        expect(type).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 8 },
            },
        })
    })

    it('parses integer type with min constraint only', () => {
        const type = parseTypeConsstraint('integer(1...)')
        expect(type).toBeInstanceOf(IntegerSet)
        expect(type).toMatchObject({
            min: 1n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 14 },
            },
        })
    })

    it('parses integer type with (exclusive) max constraint only', () => {
        const type = parseTypeConsstraint('integer(..<10)')
        expect(type).toBeInstanceOf(IntegerSet)
        expect(type).toMatchObject({
            max: 9n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 15 },
            },
        })
    })

    it('parses integer type with (inclusive) max constraint only', () => {
        const type = parseTypeConsstraint('integer(...10)')
        expect(type).toBeInstanceOf(IntegerSet)
        expect(type).toMatchObject({
            max: 10n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 15 },
            },
        })
    })

    it('parses integer type with min and (inclusive) max constraints', () => {
        const type = parseTypeConsstraint('integer(1...10)')
        expect(type).toBeInstanceOf(IntegerSet)
        expect(type).toMatchObject({
            min: 1n,
            max: 10n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 16 },
            },
        })
    })

    it('parses integer type with min and (exclusive) max constraints', () => {
        const type = parseTypeConsstraint('integer(1..<10)')
        expect(type).toBeInstanceOf(IntegerSet)
        expect(type).toMatchObject({
            min: 1n,
            max: 9n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 16 },
            },
        })
    })

    it('parses unconstrained truthvalue type', () => {
        const type = parseTypeConsstraint('truthvalue')
        expect(type).toBeInstanceOf(TruthvalueSet)
        expect(type).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 11 },
            },
        })
    })

    it('parses truthvalue type with constraints', () => {
        const type = parseTypeConsstraint('truthvalue(true, false)')
        expect(type).toBeInstanceOf(TruthvalueSet)
        expect(type).toMatchObject({
            values: ['true', 'false'],
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 24 },
            },
        })
    })

    it('parses unconstrained string type', () => {
        const type = parseTypeConsstraint('string')
        expect(type).toBeInstanceOf(StringSet)
        expect(type).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 7 },
            },
        })
    })

    it('parses rc-types', () => {
        const type = parseTypeConsstraint('MyType')
        expect(type).toBeInstanceOf(RCTypeSet)
        expect(type).toMatchObject({
            type: { name: 'MyType' },
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 7 },
            },
        })
    })
})

function parseTypeConsstraint(input: string) {
    const stream = TokenStream.read(input)
    const parser = TypeConstraintParser.create({})
    return parser.parse(stream)
}
