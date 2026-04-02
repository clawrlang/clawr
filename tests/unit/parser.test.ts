import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../src/lexer'
import { Parser } from '../../src/parser'

describe('Parser Tests', () => {
    describe('variable declaration', () => {
        for (const keyword of ['const', 'mut', 'ref'] as const)
            it(`parses ${keyword} truthvalue variable declaration correctly`, () => {
                const program = `${keyword} x: truthvalue = ambiguous`
                const ast = parse(program)
                expect(ast).toMatchObject({
                    body: [
                        {
                            kind: 'var-decl',
                            semantics: keyword,
                            name: 'x',
                            value: { kind: 'truthvalue', value: 'ambiguous' },
                        },
                    ],
                })
            })

        it('parses declaration without explicit value set', () => {
            const ast = parse('const x = ambiguous')
            expect(ast).toMatchObject({
                body: [
                    {
                        kind: 'var-decl',
                        semantics: 'const',
                        name: 'x',
                        valueSet: undefined,
                        value: { kind: 'truthvalue', value: 'ambiguous' },
                    },
                ],
            })
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
                        { semantics: 'mut', name: 'x', type: 'truthvalue' },
                        { semantics: 'mut', name: 'y', type: 'truthvalue' },
                    ],
                },
            ],
        })
    })

    it('parses field-level semantics in data declaration', () => {
        const program = `
            data Link {
                ref next: Link
                value: truthvalue
            }
        `
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'data-decl',
                    name: 'Link',
                    fields: [
                        { semantics: 'ref', name: 'next', type: 'Link' },
                        { semantics: 'mut', name: 'value', type: 'truthvalue' },
                    ],
                },
            ],
        })
    })

    it('preserves declaration field positions', () => {
        const ast = parse('data Point {\nx: truthvalue\ny: truthvalue\n}')

        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'data-decl',
                    name: 'Point',
                    fields: [
                        { name: 'x', position: { line: 2, column: 1 } },
                        { name: 'y', position: { line: 3, column: 1 } },
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

    it('parses field access correctly', () => {
        const program = 'const x: truthvalue = a.b.c.d.e.f'
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                    value: {
                        kind: 'binary',
                        operator: '.',
                        left: {
                            kind: 'binary',
                            operator: '.',
                            left: {
                                kind: 'binary',
                                operator: '.',
                                left: {
                                    kind: 'binary',
                                    operator: '.',
                                    left: {
                                        kind: 'binary',
                                        operator: '.',
                                        left: {
                                            kind: 'identifier',
                                            name: 'a',
                                        },
                                        right: {
                                            kind: 'identifier',
                                            name: 'b',
                                        },
                                    },
                                    right: { kind: 'identifier', name: 'c' },
                                },
                                right: { kind: 'identifier', name: 'd' },
                            },
                            right: { kind: 'identifier', name: 'e' },
                        },
                        right: { kind: 'identifier', name: 'f' },
                    },
                },
            ],
        })
    })

    it('parses assignment correctly', () => {
        const program = 'a = true'
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'assign',
                    target: { kind: 'identifier', name: 'a' },
                    value: { kind: 'truthvalue', value: 'true' },
                },
            ],
        })
    })

    it('parses field assignment correctly', () => {
        const program = 'p.x = true'
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'assign',
                    target: {
                        kind: 'binary',
                        operator: '.',
                        left: { kind: 'identifier', name: 'p' },
                        right: { kind: 'identifier', name: 'x' },
                    },
                    value: { kind: 'truthvalue', value: 'true' },
                },
            ],
        })
    })

    it('parses data declaration and variable initialization correctly', () => {
        const program =
            'data Point { x: truthvalue }\nmut p: Point = { x: true }'
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'data-decl',
                    name: 'Point',
                    fields: [{ name: 'x', type: 'truthvalue' }],
                },
                {
                    kind: 'var-decl',
                    semantics: 'mut',
                    name: 'p',
                    valueSet: { type: 'Point' },
                    value: {
                        kind: 'data-literal',
                        fields: {
                            x: { kind: 'truthvalue', value: 'true' },
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
