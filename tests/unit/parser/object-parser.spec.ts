import { describe, it, expect, test } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { TestErrorReporter } from '../../util'
import { ObjectParser } from '../../../src/parser/object-parser'

describe('Object Parser', () => {
    it('parses an empty object', () => {
        const code = 'object O {}'

        expect(parseObject(code)).toMatchObject({
            name: 'O',
            readonly: [],
            mutating: [],
            inheritance: [],
            fields: [],
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 12 },
            },
        })
    })

    it('parses readonly methods', () => {
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

    it('parses mutating methods', () => {
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

    it('parses inheritance initializers', () => {
        const code = `
            object O {
            inheritance:
                func init1() => {}
                func init2() => {}
            }`

        expect(parseObject(code)).toMatchObject({
            inheritance: [{ baseName: 'init1' }, { baseName: 'init2' }],
            span: {
                start: { line: 2, column: 13 },
                end: { line: 6, column: 14 },
            },
        })
    })

    it('parses fields', () => {
        const code = `
            object O {
            data:
                field1: integer
                field2: truthvalue
            }`

        expect(parseObject(code)).toMatchObject({
            fields: [{ name: 'field1' }, { name: 'field2' }],
            span: {
                start: { line: 2, column: 13 },
                end: { line: 6, column: 14 },
            },
        })
    })

    it('parses all sections together', () => {
        const code = `
            object O {
            data:
                field1: integer
                field2: truthvalue
            inheritance:
                func init() => {}
            mutating:
                func method() {}
            }`

        expect(parseObject(code)).toMatchObject({
            fields: [{ name: 'field1' }, { name: 'field2' }],
            inheritance: [{ baseName: 'init' }],
            mutating: [{ baseName: 'method' }],
            span: {
                start: { line: 2, column: 13 },
                end: { line: 10, column: 14 },
            },
        })
    })

    describe('parses sections in arbitrary order', () => {
        test.each([
            ['data', 'mutating', 'inheritance'],
            ['data', 'inheritance', 'mutating'],
            ['mutating', 'data', 'inheritance'],
            ['mutating', 'inheritance', 'data'],
            ['inheritance', 'data', 'mutating'],
            ['inheritance', 'mutating', 'data'],
        ])('%s:%s:%s:', (first, second, third) => {
            const code = `object O {${first}:${second}:${third}:}`
            expect(() => parseObject(code)).not.toThrow()
        })
    })

    describe('throws if section names are repeated', () => {
        test.each(['data', 'mutating', 'inheritance'])('%s:', (section) => {
            const code = `object O {${section}:${section}:}`
            expect(() => parseObject(code)).toThrow(
                `Repeated ${section} section`,
            )
        })
    })
})

function parseObject(input: string) {
    const errorReporter = new TestErrorReporter()
    const stream = TokenStream.read(input, errorReporter)
    const parser = ObjectParser.create({ errorReporter })
    return parser.parse(stream)
}
