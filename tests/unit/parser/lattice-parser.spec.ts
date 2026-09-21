import { TokenStream } from '@/lexer'
import {
    IntegerRange,
    RCTypeSet,
    StringSet,
    TruthvalueSet,
} from '@/model/value-set'
import { DomainParser } from '@/parser/domain-parser'
import { TestErrorReporter } from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('DomainParser', () => {
    it('parses unconstrained integer type', () => {
        const domain = parseDomain('integer')
        expect(domain).toBeInstanceOf(IntegerRange)
        expect(domain).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 8 },
            },
        })
    })

    it('parses integer type with min constraint only', () => {
        const domain = parseDomain('integer(1...)')
        expect(domain).toBeInstanceOf(IntegerRange)
        expect(domain).toMatchObject({
            min: 1n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 14 },
            },
        })
    })

    it('parses integer type with (exclusive) max constraint only', () => {
        const domain = parseDomain('integer(..<10)')
        expect(domain).toBeInstanceOf(IntegerRange)
        expect(domain).toMatchObject({
            max: 9n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 15 },
            },
        })
    })

    it('parses integer type with (inclusive) max constraint only', () => {
        const domain = parseDomain('integer(...10)')
        expect(domain).toBeInstanceOf(IntegerRange)
        expect(domain).toMatchObject({
            max: 10n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 15 },
            },
        })
    })

    it('parses integer type with min and (inclusive) max constraints', () => {
        const domain = parseDomain('integer(1...10)')
        expect(domain).toBeInstanceOf(IntegerRange)
        expect(domain).toMatchObject({
            min: 1n,
            max: 10n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 16 },
            },
        })
    })

    it('parses integer type with min and (exclusive) max constraints', () => {
        const domain = parseDomain('integer(1..<10)')
        expect(domain).toBeInstanceOf(IntegerRange)
        expect(domain).toMatchObject({
            min: 1n,
            max: 9n,
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 16 },
            },
        })
    })

    it('parses unconstrained truthvalue type', () => {
        const domain = parseDomain('truthvalue')
        expect(domain).toBeInstanceOf(TruthvalueSet)
        expect(domain).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 11 },
            },
        })
    })

    it('parses truthvalue type with constraints', () => {
        const domain = parseDomain('truthvalue(true, false)')
        expect(domain).toBeInstanceOf(TruthvalueSet)
        expect(domain).toMatchObject({
            values: ['true', 'false'],
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 24 },
            },
        })
    })

    it('parses unconstrained string type', () => {
        const domain = parseDomain('string')
        expect(domain).toBeInstanceOf(StringSet)
        expect(domain).toMatchObject({
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 7 },
            },
        })
    })

    it('parses rc-types', () => {
        const domain = parseDomain('MyType')
        expect(domain).toBeInstanceOf(RCTypeSet)
        expect(domain).toMatchObject({
            type: { name: 'MyType' },
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 7 },
            },
        })
    })
})

function parseDomain(input: string) {
    const errorReporter = new TestErrorReporter()
    const stream = TokenStream.read(input, errorReporter)
    const parser = DomainParser.create({ errorReporter })
    return parser.parse(stream)
}
