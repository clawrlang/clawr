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

    it('parses explicit copy expression', () => {
        const ast = parse('mut x: Box = copy(shared)')
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'mut',
                    name: 'x',
                    valueSet: { type: 'Box' },
                    value: {
                        kind: 'copy',
                        value: { kind: 'identifier', name: 'shared' },
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

    it('parses field access chain in body following import block', () => {
        const ast = parse(
            'import Point from "models"\nconst x: truthvalue = p.a.b',
        )
        expect(ast).toMatchObject({
            imports: [{ kind: 'import', items: [{ name: 'Point' }] }],
            body: [
                {
                    kind: 'var-decl',
                    name: 'x',
                    value: {
                        kind: 'binary',
                        operator: '.',
                        left: {
                            kind: 'binary',
                            operator: '.',
                            left: { kind: 'identifier', name: 'p' },
                            right: { kind: 'identifier', name: 'a' },
                        },
                        right: { kind: 'identifier', name: 'b' },
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

    it('parses if/else block statements', () => {
        const program = 'if true { print true } else { print false }'
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'if',
                    condition: { kind: 'truthvalue', value: 'true' },
                    thenBranch: [
                        {
                            kind: 'print',
                            value: { kind: 'truthvalue', value: 'true' },
                        },
                    ],
                    elseBranch: [
                        {
                            kind: 'print',
                            value: { kind: 'truthvalue', value: 'false' },
                        },
                    ],
                },
            ],
        })
    })

    it('parses else-if chains', () => {
        const program = 'if true { print true } else if false { print false }'
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'if',
                    elseBranch: [
                        {
                            kind: 'if',
                            condition: { kind: 'truthvalue', value: 'false' },
                            thenBranch: [
                                {
                                    kind: 'print',
                                    value: {
                                        kind: 'truthvalue',
                                        value: 'false',
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        })
    })

    it('parses while loops with break and continue', () => {
        const program = 'while ambiguous { continue break }'
        const ast = parse(program)
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'while',
                    condition: { kind: 'truthvalue', value: 'ambiguous' },
                    body: [{ kind: 'continue' }, { kind: 'break' }],
                },
            ],
        })
    })

    it('parses import declarations with aliases before top-level body', () => {
        const program =
            'import Token as Tok, Span from "lexer/tokens"\nconst x = ambiguous'
        const ast = parse(program)

        expect(ast).toMatchObject({
            imports: [
                {
                    kind: 'import',
                    items: [{ name: 'Token', alias: 'Tok' }, { name: 'Span' }],
                    modulePath: 'lexer/tokens',
                },
            ],
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

    it('parses single-item import declarations without aliases', () => {
        const ast = parse('import Point from "models/point"\nprint true')

        expect(ast).toMatchObject({
            imports: [
                {
                    kind: 'import',
                    items: [{ name: 'Point' }],
                    modulePath: 'models/point',
                },
            ],
            body: [
                { kind: 'print', value: { kind: 'truthvalue', value: 'true' } },
            ],
        })
    })

    it('parses helper data declarations at top level', () => {
        const program = 'helper data ParserState { value: truthvalue }'
        const ast = parse(program)

        expect(ast).toMatchObject({
            imports: [],
            body: [
                {
                    kind: 'data-decl',
                    visibility: 'helper',
                    name: 'ParserState',
                    fields: [
                        { semantics: 'mut', name: 'value', type: 'truthvalue' },
                    ],
                },
            ],
        })
    })

    it('rejects helper before unsupported top-level declarations', () => {
        expect(() => parse('helper const x = ambiguous')).toThrow(
            '1:1:helper is only supported before data, func, object, or service declarations',
        )
    })

    it('reports malformed import lists precisely', () => {
        expect(() => parse('import Token, from "lexer/tokens"')).toThrow(
            "1:15:Expected identifier after ',' in import list, got 'from'",
        )

        expect(() => parse('import Token Span from "lexer/tokens"')).toThrow(
            "1:14:Expected ',' or 'from' after import item, got identifier 'Span'",
        )
    })

    it('reports missing import module path strings precisely', () => {
        expect(() => parse('import Token from')).toThrow(
            "1:14:Expected module path string literal after 'from', got EOF",
        )

        expect(() => parse('import Token from ambiguous')).toThrow(
            "1:14:Expected module path string literal after 'from', got truth literal 'ambiguous'",
        )
    })
})

describe('Function declaration tests', () => {
    it('parses a simple function with no parameters and no return type', () => {
        const ast = parse('func greet() { print true }')
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'func-decl',
                    name: 'greet',
                    visibility: 'public',
                    parameters: [],
                    returnType: undefined,
                    body: {
                        kind: 'block',
                        statements: [{ kind: 'print' }],
                    },
                },
            ],
        })
    })

    it('parses a function with a return type annotation', () => {
        const ast = parse(
            'func makePoint() -> Point { const p: Point = { x: true } }',
        )
        expect(ast).toMatchObject({
            body: [
                {
                    kind: 'func-decl',
                    name: 'makePoint',
                    returnType: 'Point',
                    returnSemantics: undefined,
                    body: { kind: 'block' },
                },
            ],
        })
    })

    it('parses a function with const and ref return semantics', () => {
        const cow = parse(
            'func sharedPoint() -> const Point { const p: Point = { x: true } }',
        )
        expect(cow.body[0]).toMatchObject({
            kind: 'func-decl',
            returnType: 'Point',
            returnSemantics: 'const',
        })

        const ref = parse(
            'func refPoint() -> ref Point { const p: Point = { x: true } }',
        )
        expect(ref.body[0]).toMatchObject({
            kind: 'func-decl',
            returnType: 'Point',
            returnSemantics: 'ref',
        })
    })

    it('parses a function with unlabeled parameters', () => {
        const ast = parse('func add(a: integer, b: integer) -> integer { }')
        expect(ast.body[0]).toMatchObject({
            kind: 'func-decl',
            name: 'add',
            parameters: [
                { label: undefined, name: 'a', type: 'integer' },
                { label: undefined, name: 'b', type: 'integer' },
            ],
        })
    })

    it('parses a function with labeled parameters', () => {
        const ast = parse('func deposit(amount cents: integer) -> Account { }')
        expect(ast.body[0]).toMatchObject({
            kind: 'func-decl',
            name: 'deposit',
            parameters: [{ label: 'amount', name: 'cents', type: 'integer' }],
        })
    })

    it('parses a function with parameter semantics prefixes', () => {
        const ast = parse(
            'func update(target: ref Point, value: truthvalue) { }',
        )
        expect(ast.body[0]).toMatchObject({
            kind: 'func-decl',
            parameters: [
                { semantics: 'ref', name: 'target', type: 'Point' },
                { semantics: undefined, name: 'value', type: 'truthvalue' },
            ],
        })
    })

    it('parses shorthand expression body', () => {
        const ast = parse('func isActive() -> truthvalue => true')
        expect(ast.body[0]).toMatchObject({
            kind: 'func-decl',
            name: 'isActive',
            returnType: 'truthvalue',
            body: {
                kind: 'expression',
                value: { kind: 'truthvalue', value: 'true' },
            },
        })
    })

    it('parses helper function declaration', () => {
        const ast = parse('helper func scanToken() -> Token { }')
        expect(ast.body[0]).toMatchObject({
            kind: 'func-decl',
            name: 'scanToken',
            visibility: 'helper',
        })
    })

    it('rejects helper before unsupported declaration kinds', () => {
        expect(() => parse('helper const x: truthvalue = true')).toThrow(
            'helper is only supported before data, func, object, or service declarations',
        )
    })
})

function parse(code: string) {
    const stream = new TokenStream(code, 'test.clawr')
    const parser = new Parser(stream)
    return parser.parse()
}

describe('Object and service declaration tests', () => {
    it('parses a minimal object with no sections', () => {
        const ast = parse('object Empty { }')
        expect(ast.body[0]).toMatchObject({
            kind: 'object-decl',
            name: 'Empty',
            visibility: 'public',
            supertype: undefined,
            sections: [],
        })
    })

    it('parses an object with only a data section', () => {
        const ast = parse('object Money { data: const cents: integer }')
        expect(ast.body[0]).toMatchObject({
            kind: 'object-decl',
            name: 'Money',
            sections: [
                {
                    kind: 'data',
                    fields: [
                        { semantics: 'const', name: 'cents', type: 'integer' },
                    ],
                },
            ],
        })
    })

    it('parses an object with methods then a data section', () => {
        const ast = parse(
            'object Money { func dollars(self: const Money) -> integer { } data: const cents: integer }',
        )
        const decl = ast.body[0]
        expect(decl).toMatchObject({ kind: 'object-decl', name: 'Money' })
        if (decl.kind !== 'object-decl') throw new Error('unreachable')
        expect(decl.sections[0]).toMatchObject({
            kind: 'methods',
            items: [{ kind: 'func-decl', name: 'dollars' }],
        })
        expect(decl.sections[1]).toMatchObject({
            kind: 'data',
            fields: [{ name: 'cents', type: 'integer' }],
        })
    })

    it('parses an object with a mutating section', () => {
        const ast = parse(
            'object Account { mutating: func deposit(self: ref Account, amount: integer) { } }',
        )
        const decl = ast.body[0]
        expect(decl).toMatchObject({ kind: 'object-decl', name: 'Account' })
        if (decl.kind !== 'object-decl') throw new Error('unreachable')
        expect(decl.sections[0]).toMatchObject({
            kind: 'mutating',
            items: [{ kind: 'func-decl', name: 'deposit' }],
        })
    })

    it('parses an object with a supertype', () => {
        const ast = parse('object Student: Entity { }')
        expect(ast.body[0]).toMatchObject({
            kind: 'object-decl',
            name: 'Student',
            supertype: 'Entity',
        })
    })

    it('parses a helper method inside an object', () => {
        const ast = parse(
            'object Foo { helper func internalHelper() -> truthvalue { } }',
        )
        const decl = ast.body[0]
        if (decl.kind !== 'object-decl') throw new Error('unreachable')
        expect(decl.sections[0]).toMatchObject({
            kind: 'methods',
            items: [
                {
                    kind: 'func-decl',
                    name: 'internalHelper',
                    visibility: 'helper',
                },
            ],
        })
    })

    it('parses a helper object declaration', () => {
        const ast = parse('helper object Internal { }')
        expect(ast.body[0]).toMatchObject({
            kind: 'object-decl',
            name: 'Internal',
            visibility: 'helper',
        })
    })

    it('parses a minimal service with no sections', () => {
        const ast = parse('service Empty { }')
        expect(ast.body[0]).toMatchObject({
            kind: 'service-decl',
            name: 'Empty',
            visibility: 'public',
            sections: [],
        })
    })

    it('parses a service with default and mutating sections', () => {
        const ast = parse(
            'service Repo { func getUser(self: const Repo, id: integer) -> User { } mutating: func updateUser(self: ref Repo, user: User) { } }',
        )
        const decl = ast.body[0]
        expect(decl).toMatchObject({ kind: 'service-decl', name: 'Repo' })
        if (decl.kind !== 'service-decl') throw new Error('unreachable')
        expect(decl.sections[0]).toMatchObject({
            kind: 'methods',
            items: [{ kind: 'func-decl', name: 'getUser' }],
        })
        expect(decl.sections[1]).toMatchObject({
            kind: 'mutating',
            items: [{ kind: 'func-decl', name: 'updateUser' }],
        })
    })

    it('parses a helper service declaration', () => {
        const ast = parse('helper service InternalRepo { }')
        expect(ast.body[0]).toMatchObject({
            kind: 'service-decl',
            name: 'InternalRepo',
            visibility: 'helper',
        })
    })

    it('rejects method declarations inside data section', () => {
        expect(() => parse('object Bad { data: func nope() { } }')).toThrow(
            'Expected IDENTIFIER, got KEYWORD',
        )
    })

    it('rejects field declarations inside mutating section', () => {
        expect(() =>
            parse('service Bad { mutating: const x: integer }'),
        ).toThrow('Expected method declaration (func or helper func)')
    })
})
