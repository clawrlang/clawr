import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../src/lexer'
import { Parser } from '../../src/parser'

describe('Parser Tests', () => {
    it('parses truthvalue variable declaration correctly', () => {
        const program = `const x: truthvalue = ambiguous`
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    value: { kind: 'truthvalue', value: 'ambiguous' },
                },
            ],
        })
    })

    it('parses print of truthvalue literal correctly', () => {
        const program = `print true`
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'print',
                    value: { kind: 'truthvalue', value: 'true' },
                },
            ],
        })
    })

    it('parses print of truthvalue variable correctly', () => {
        const program = `
            const x: truthvalue = ambiguous
            print x
        `
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    value: { kind: 'truthvalue', value: 'ambiguous' },
                },
                {
                    kind: 'print',
                    value: { kind: 'identifier', name: 'x' },
                },
            ],
        })
    })

    it('parses data declaration correctly', () => {
        const program = `
            data Point {
                x: truthvalue
                y: truthvalue
            }
        `
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'data-decl',
                    name: 'Point',
                    fields: [
                        { name: 'x', type: 'truthvalue' },
                        { name: 'y', type: 'truthvalue' },
                    ],
                },
            ],
        })
    })

    it('parses data literal correctly', () => {
        const program = 'const p: Point = { x: true, y: false }'
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'p',
                    valueSet: { type: 'Point' },
                    value: {
                        kind: 'data-literal',
                        fields: {
                            x: { kind: 'truthvalue', value: 'true' },
                            y: { kind: 'truthvalue', value: 'false' },
                        },
                    },
                },
            ],
        })
    })
})

function parse(code: string) {
    const stream = new TokenStream(code, 'test.clawr')
    const parser = new Parser(stream)
    return parser.parse()
}
