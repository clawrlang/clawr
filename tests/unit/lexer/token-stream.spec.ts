import { describe, expect, it, test } from 'bun:test'
import { Token, TokenStream } from '../../../src/lexer'
import { decimal } from 'decimalish'
import { TestErrorReporter } from '../../util'

describe('TokenStream', () => {
    describe('INTEGER_LITERAL', () => {
        const examples = {
            '1': { int: 1n, s: '1' },
            'big integer': {
                int: 1_208_925_819_614_629_174_706_176n,
                s: '1_208_925_819_614_629_174_706_176',
            },
        }
        for (const [name, { s, int }] of Object.entries(examples)) {
            test(name, () => {
                const tokens = [...tokenize(s)]
                expect(tokens).toHaveLength(1)
                expect(tokens[0]).toMatchObject({
                    kind: 'INTEGER_LITERAL',
                    value: int,
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: s.length + 1 },
                })
            })
        }
    })

    describe('REAL_LITERAL', () => {
        const examples = {
            '1.1': { real: decimal(1.1), s: '1.1' },
            'big decimal': {
                real: decimal('1.234567890e123456'),
                s: '1.234_567_890e123_456',
            },
            'signed exponent': {
                real: decimal('2.5e+3'),
                s: '2.5e+3',
            },
        }
        for (const [name, { s, real }] of Object.entries(examples)) {
            test(name, () => {
                const tokens = [...tokenize(s)]
                expect(tokens).toHaveLength(1)
                expect(tokens[0]).toMatchObject({
                    kind: 'REAL_LITERAL',
                    value: real,
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: s.length + 1 },
                })
            })
        }
    })

    describe('TRUTHVALUE_LITERAL', () => {
        const truthvalues = ['false', 'ambiguous', 'true']
        for (const keyword of truthvalues) {
            test(keyword, () => {
                const tokens = [...tokenize(keyword)]
                expect(tokens).toHaveLength(1)
                expect(tokens[0]).toMatchObject({
                    kind: 'TRUTHVALUE_LITERAL',
                    value: keyword,
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: keyword.length + 1 },
                })
            })
        }
    })

    describe('STRING_LITERAL', () => {
        test('simple string', () => {
            const tokens = [...tokenize('1 "string" 1')]
            expect(tokens).toHaveLength(3)
            expect(tokens[1]).toMatchObject({
                kind: 'STRING_LITERAL',
                value: 'string',
                start: { line: 1, column: 3 },
                end: { line: 1, column: 11 },
            })
        })
        test('escaped double-quote', () => {
            const tokens = [...tokenize('"str\\"ing" 1')]
            expect(tokens).toHaveLength(2)
            expect(tokens[0]).toMatchObject({
                kind: 'STRING_LITERAL',
                value: 'str\\"ing',
                start: { line: 1, column: 1 },
                end: { line: 1, column: 11 },
            })
        })
        test('escaped backslash', () => {
            const tokens = [...tokenize('"str\\\\" 1')]
            expect(tokens).toHaveLength(2)
            expect(tokens[0]).toMatchObject({
                kind: 'STRING_LITERAL',
                value: 'str\\\\',
                start: { line: 1, column: 1 },
                end: { line: 1, column: 8 },
            })
        })
    })

    describe('REGEX_LITERAL', () => {
        test('simple regex', () => {
            const tokens = [...tokenize('( /regex/ )')]
            expect(tokens).toHaveLength(3)
            expect(tokens[1]).toMatchObject({
                kind: 'REGEX_LITERAL',
                pattern: 'regex',
                start: { line: 1, column: 3 },
                end: { line: 1, column: 10 },
            })
        })
        test('escaped slash', () => {
            const tokens = [...tokenize('/reg\\/ex/ 1')]
            expect(tokens).toHaveLength(2)
            expect(tokens[0]).toMatchObject({
                kind: 'REGEX_LITERAL',
                pattern: 'reg\\/ex',
                start: { line: 1, column: 1 },
                end: { line: 1, column: 10 },
            })
        })
        test('class category slash', () => {
            const tokens = [...tokenize('/reg[/]ex/ 1')]
            expect(tokens).toHaveLength(2)
            expect(tokens[0]).toMatchObject({
                kind: 'REGEX_LITERAL',
                pattern: 'reg[/]ex',
                start: { line: 1, column: 1 },
                end: { line: 1, column: 11 },
            })
        })
        test('escaped backslash', () => {
            const tokens = [...tokenize('/reg\\\\/ex/ 1')]
            expect(tokens[0]).toMatchObject({
                kind: 'REGEX_LITERAL',
                pattern: 'reg\\\\',
                start: { line: 1, column: 1 },
                end: { line: 1, column: 8 },
            })
            expect(tokens[1]).toMatchObject({
                kind: 'IDENTIFIER',
                identifier: 'ex',
                start: { line: 1, column: 8 },
            })
        })
        it('allows modifiers', () => {
            const tokens = [...tokenize('/regex/gmi')]
            expect(tokens).toHaveLength(1)
            expect(tokens[0]).toMatchObject({
                kind: 'REGEX_LITERAL',
                pattern: 'regex',
                modifiers: new Set('gmi'),
                start: { line: 1, column: 1 },
                end: { line: 1, column: 11 },
            })
        })

        it('is recognisable after assignment operator', () => {
            const code =
                'ref r: regex = /[a-z]+/i // ref keyword - regular expression'
            const tokens = [...tokenize(code)]
            expect(tokens).toMatchObject([
                { kind: 'KEYWORD', keyword: 'ref' },
                { kind: 'IDENTIFIER', identifier: 'r' },
                { kind: 'PUNCTUATION', symbol: ':' },
                { kind: 'IDENTIFIER', identifier: 'regex' },
                { kind: 'PUNCTUATION', symbol: '=' },
                {
                    kind: 'REGEX_LITERAL',
                    pattern: '[a-z]+',
                    modifiers: new Set('i'),
                },
            ])
        })
    })

    describe('KEYWORD', () => {
        const keywords = [
            'const',
            'mut',
            'ref',
            'helper',
            'companion',
            'import',
            'from',
            'as',
        ]
        for (const keyword of keywords) {
            test(keyword, () => {
                const tokens = [...tokenize(keyword)]
                expect(tokens).toHaveLength(1)
                expect(tokens[0]).toMatchObject({
                    kind: 'KEYWORD',
                    keyword,
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: keyword.length + 1 },
                })
            })
        }

        it('tokenizes import syntax keyword combinations in sequence', () => {
            const tokens = [
                ...tokenize('import Token as Tok from "lexer/tokens"'),
            ]
            expect(tokens).toMatchObject([
                { kind: 'KEYWORD', keyword: 'import' },
                { kind: 'IDENTIFIER', identifier: 'Token' },
                { kind: 'KEYWORD', keyword: 'as' },
                { kind: 'IDENTIFIER', identifier: 'Tok' },
                { kind: 'KEYWORD', keyword: 'from' },
                { kind: 'STRING_LITERAL', value: 'lexer/tokens' },
            ])
        })
    })

    describe('PUNCTUATION', () => {
        const symbols = ['=', '[', ']', '(', ')', '{', '}', ',', ':', '@', '=>']
        for (const symbol of symbols) {
            test(symbol, () => {
                const tokens = [...tokenize(symbol)]
                expect(tokens).toHaveLength(1)
                expect(tokens[0]).toMatchObject({
                    kind: 'PUNCTUATION',
                    symbol,
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: symbol.length + 1 },
                })
            })
        }

        for (const symbol of ['()', '[]', '{}']) {
            it(`separates brackets ${symbol}`, () => {
                const tokens = [...tokenize(symbol)]

                expect(tokens).toMatchObject([
                    {
                        kind: 'PUNCTUATION',
                        symbol: symbol[0],
                        start: { line: 1, column: 1 },
                        end: { line: 1, column: 2 },
                    },
                    {
                        kind: 'PUNCTUATION',
                        symbol: symbol[1],
                        start: { line: 1, column: 2 },
                        end: { line: 1, column: 3 },
                    },
                ])
            })
        }
    })

    describe('OPERATOR', () => {
        const operators = [
            '+',
            '-',
            '&&',
            '<<',
            '|',
            '===',
            '!=',
            '≠',
            '=\u0338',
            '==',
            '!==',
            '<=',
            '>=',
            '.',
            '->',
            '...',
            '..',
            '..<',
        ]
        for (const operator of operators) {
            test(operator, () => {
                const tokens = [...tokenize(operator)]
                expect(tokens).toHaveLength(1)
                expect(tokens[0]).toMatchObject({
                    kind: 'OPERATOR',
                    operator,
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: operator.length + 1 },
                })
            })
        }

        test('/', () => {
            const tokens = [...tokenize('1 / 2')]
            expect(tokens).toHaveLength(3)
            expect(tokens[1]).toMatchObject({
                kind: 'OPERATOR',
                operator: '/',
                start: { line: 1, column: 3 },
                end: { line: 1, column: 4 },
            })
        })
    })

    describe('IDENTIFIER', () => {
        const examples = ['x', 'point', '_hidden', 'with_underscore']
        for (const identifier of examples) {
            test(identifier, () => {
                const tokens = [...tokenize(identifier)]
                expect(tokens).toHaveLength(1)
                expect(tokens[0]).toMatchObject({
                    kind: 'IDENTIFIER',
                    identifier,
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: identifier.length + 1 },
                })
            })
        }

        const underlineExamples = ['_', '__', '___']
        for (const identifier of underlineExamples) {
            test(identifier, () => {
                const tokens = [...tokenize(identifier)]
                expect(tokens).toHaveLength(1)
                expect(tokens[0]).toMatchObject({
                    kind: 'IDENTIFIER',
                    identifier,
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: identifier.length + 1 },
                })
            })
        }

        test('allows unicode script identifiers', () => {
            const tokens = [...tokenize('变量')]
            expect(tokens).toHaveLength(1)
            expect(tokens[0]).toMatchObject({
                kind: 'IDENTIFIER',
                identifier: '变量',
                start: { line: 1, column: 1 },
                end: { line: 1, column: 3 },
            })
        })

        test('normalizes identifiers to NFC', () => {
            const decomposed = 'e\u0301'
            const tokens = [...tokenize(decomposed)]
            expect(tokens).toHaveLength(1)
            expect(tokens[0]).toMatchObject({
                kind: 'IDENTIFIER',
                identifier: 'é',
                start: { line: 1, column: 1 },
                end: { line: 1, column: 3 },
            })
        })
    })

    test('dot operator', () => {
        const tokens = [...tokenize('3a.b')]
        expect(tokens).toHaveLength(3)
        expect(tokens[1]).toMatchObject({
            kind: 'OPERATOR',
            operator: '.',
            start: { line: 1, column: 3 },
            end: { line: 1, column: 4 },
        })
    })

    test('multiple tokens', () => {
        const tokens = [...tokenize('const x: 1\n1.1')]
        expect(tokens).toHaveLength(6)
        expect(tokens[0]).toMatchObject({
            kind: 'KEYWORD',
            keyword: 'const',
            start: { line: 1, column: 1 },
            end: { line: 1, column: 6 },
        })
        expect(tokens[1]).toMatchObject({
            kind: 'IDENTIFIER',
            identifier: 'x',
            start: { line: 1, column: 7 },
            end: { line: 1, column: 8 },
        })
        expect(tokens[2]).toMatchObject({
            kind: 'PUNCTUATION',
            symbol: ':',
            start: { line: 1, column: 8 },
            end: { line: 1, column: 9 },
        })
        expect(tokens[3]).toMatchObject({
            kind: 'INTEGER_LITERAL',
            value: 1n,
            start: { line: 1, column: 10 },
            end: { line: 1, column: 11 },
        })
        expect(tokens[4]).toMatchObject({
            kind: 'NEWLINE',
            start: { line: 1, column: 11 },
            end: { line: 2, column: 1 },
        })
        expect(tokens[5]).toMatchObject({
            kind: 'REAL_LITERAL',
            value: decimal(1.1),
            start: { line: 2, column: 1 },
            end: { line: 2, column: 4 },
        })
    })

    describe('Ignored characters', () => {
        describe('comments', () => {
            test('C comments: /* */', () => {
                const tokens = [...tokenize('/* C comment */ 1')]
                expect(tokens).toHaveLength(1)
                expect(tokens[0]).toMatchObject({
                    kind: 'INTEGER_LITERAL',
                    value: 1n,
                    start: { line: 1, column: 17 },
                    end: { line: 1, column: 18 },
                })
            })

            test('C++ comments: //', () => {
                const tokens = [...tokenize('// C++ comment \n1')]
                expect(tokens).toHaveLength(2)
                expect(tokens[0]).toMatchObject({ kind: 'NEWLINE' })
                expect(tokens[1]).toMatchObject({
                    kind: 'INTEGER_LITERAL',
                    value: 1n,
                    start: { line: 2, column: 1 },
                    end: { line: 2, column: 2 },
                })
            })

            it('does not consume newline after comment', () => {
                const tokens = [...tokenize('1 // comment\n2')]

                expect(tokens).toHaveLength(3)
                expect(tokens).toMatchObject([
                    { kind: 'INTEGER_LITERAL' },
                    { kind: 'NEWLINE' },
                    { kind: 'INTEGER_LITERAL' },
                ])
            })
        })

        test('non-breaking space', () => {
            const tokens = [...tokenize('  \u00a0 1')]
            expect(tokens).toHaveLength(1)
            expect(tokens[0]).toMatchObject({
                kind: 'INTEGER_LITERAL',
                start: { line: 1, column: 5 },
                end: { line: 1, column: 6 },
            })
        })

        test('whitespace around newline', () => {
            const tokens = [...tokenize(' \n  \n')]
            expect(tokens).toHaveLength(1)
            expect(tokens[0]).toMatchObject({
                kind: 'NEWLINE',
                start: { line: 1, column: 2 },
                end: { line: 2, column: 1 },
            })
        })
    })

    describe('reserved implementation glyphs', () => {
        for (const glyph of ['·', '¸', 'ˇ', '˛']) {
            test(`rejects ${glyph}`, () => {
                expect(() => [...tokenize(`x${glyph}y`)]).toThrow(
                    /Reserved implementation glyph/,
                )
                expect(errorReporter.errors).toMatchObject([
                    {
                        location: {
                            start: { line: 1, column: 2 },
                            end: { line: 1, column: 2 },
                        },
                    },
                ])
            })
        }
    })

    describe('forbidden unicode identifier code points', () => {
        test('rejects zero-width non-joiner in identifier', () => {
            expect(() => [...tokenize('ab\u200Ccd')]).toThrow(
                /Forbidden Unicode character/,
            )
            expect(errorReporter.errors).toMatchObject([
                {
                    location: {
                        start: { line: 1, column: 3 },
                        end: { line: 1, column: 4 },
                    },
                },
            ])
        })
    })

    let errorReporter: TestErrorReporter

    function* tokenize(source: string): Generator<Token> {
        errorReporter = new TestErrorReporter('test-stream')
        const stream = TokenStream.read(source, errorReporter)
        while (true) {
            const t = stream.next({ stopAtNewline: true })
            if (!t) return
            yield t
        }
    }
})
