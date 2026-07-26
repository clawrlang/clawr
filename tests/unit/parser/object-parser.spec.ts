import { describe, it, expect } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { TestErrorReporter } from '../../util'
import { ObjectParser } from '../../../src/parser/object-parser'

describe('Object Parser', () => {
    it('parses an empty object', () => {
        const code = 'object O {}'

        expect(parseObject(code)).toMatchObject({
            name: 'O',
            readonly: [],
            fields: [],
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 12 },
            },
        })
    })

    it('parses an object with readonly methods', () => {
        const code = `
            object O {
                func method1() => 42
                func method2() => true
            }`

        expect(parseObject(code)).toMatchObject({
            readonly: [{ baseName: 'method1' }, { baseName: 'method2' }],
            span: {
                start: { line: 2, column: 13 },
                end: { line: 5, column: 14 },
            },
        })
    })

    it('parses an object with mutating methods', () => {
        const code = `
            object O {
            mutating:
                func method1() {}
                func method2() {}
            }`

        expect(parseObject(code)).toMatchObject({
            mutating: [{ baseName: 'method1' }, { baseName: 'method2' }],
            span: {
                start: { line: 2, column: 13 },
                end: { line: 6, column: 14 },
            },
        })
    })

    it('parses an object with fields', () => {
        const code = `
            object O {
            data:
                field1: Integer
                field2: TruthValue
            }`

        expect(parseObject(code)).toMatchObject({
            fields: [
                { name: 'field1', type: 'Integer' },
                { name: 'field2', type: 'TruthValue' },
            ],
            span: {
                start: { line: 2, column: 13 },
                end: { line: 6, column: 14 },
            },
        })
    })
})

function parseObject(input: string) {
    const errorReporter = new TestErrorReporter()
    const stream = TokenStream.read(input, errorReporter)
    const parser = ObjectParser.create({ errorReporter })
    return parser.parse(stream)
}
