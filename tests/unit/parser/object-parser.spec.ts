import { describe, it, expect, test } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { TestErrorReporter } from '../../util'
import { ObjectDeclarationParser } from '../../../src/parser/object-declaration-parser'
import { ISOLATED } from '../../../src/model/isolation-level'

describe('Object Parser', () => {
    it('parses an empty object', () => {
        const code = 'object O {}'

        expect(parseObject(code)).toMatchObject({
            name: 'O',
            kind: 'object',
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

    it('parses object with inheritance', () => {
        const code = 'object Sub: Super {}'

        expect(parseObject(code)).toMatchObject({
            name: 'Sub',
            kind: 'object',
            superType: 'Super',
            readonly: [],
            mutating: [],
            inheritance: [],
            fields: [],
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 21 },
            },
        })
    })

    it('parses service', () => {
        const code = 'service S {}'
        expect(parseObject(code)).toMatchObject({
            name: 'S',
            kind: 'service',
            readonly: [],
            mutating: [],
            inheritance: [],
            fields: [],
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 13 },
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
            state:
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

    it('parses default field values', () => {
        const code = `
            object O {
            state:
                const field1: integer = 10
                const field2: truthvalue = true
            }`

        expect(parseObject(code)).toMatchObject({
            fields: [
                {
                    name: 'field1',
                    isImmutable: true,
                    valueSet: { isolationLevel: ISOLATED },
                    defaultValue: { value: 10n },
                },
                {
                    name: 'field2',
                    isImmutable: true,
                    valueSet: { isolationLevel: ISOLATED },
                    defaultValue: { value: 'true' },
                },
            ],
            span: {
                start: { line: 2, column: 13 },
                end: { line: 6, column: 14 },
            },
        })
    })

    it('parses all sections together', () => {
        const code = `
            object O {
            state:
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
            ['state', 'mutating', 'inheritance'],
            ['state', 'inheritance', 'mutating'],
            ['mutating', 'state', 'inheritance'],
            ['mutating', 'inheritance', 'state'],
            ['inheritance', 'state', 'mutating'],
            ['inheritance', 'mutating', 'state'],
        ])('%s:%s:%s:', (first, second, third) => {
            const code = `object O {${first}:${second}:${third}:}`
            expect(() => parseObject(code)).not.toThrow()
        })
    })

    describe('throws if section names are repeated', () => {
        test.each(['state', 'mutating', 'inheritance'])('%s:', (section) => {
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
    const parser = ObjectDeclarationParser.create({ errorReporter })
    return parser.parse(stream)
}
