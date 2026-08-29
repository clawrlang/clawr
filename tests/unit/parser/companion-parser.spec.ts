import { describe, expect, it } from 'bun:test'
import { TokenStream } from '@/lexer'
import { TestErrorReporter } from '@@/util'
import { Context } from '@/parser'
import { FunctionDeclarationParser } from '@/parser/function-declaration-parser'
import { Companion } from '@/model/companion'
import { VariableDeclaration } from '@/model/variable-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { VariableDeclarationParser } from '@/parser/variable-declaration-parser'

describe('Companion Parser', () => {
    it('parses an empty companion', () => {
        const code = 'companion O {}'

        const result = parseCompanion(code)
        expect(result).toMatchObject({
            name: 'O',
            methods: [],
            span: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 15 },
            },
        })
    })

    it('parses companion fields', () => {
        const code = `
            companion O {
                const x: integer = 10
            }
        `

        const result = parseCompanion(code)
        expect(result).toMatchObject({
            name: 'O',
            fields: [
                {
                    name: 'x',
                    isImmutable: true,
                    initialValue: { value: { min: 10n, max: 10n } },
                },
            ],
        })
    })

    it('parses companion methods', () => {
        const code = `
            companion O {
                func companionMethod() => true
            }
        `

        const result = parseCompanion(code)
        expect(result).toMatchObject({
            name: 'O',
            methods: [{ baseName: 'companionMethod' }],
        })
    })
})

function parseCompanion(code: string) {
    const errorReporter = new TestErrorReporter()
    const stream = TokenStream.read(code, errorReporter)
    const parser = CompanionParser.create({ errorReporter })
    return parser.parse(stream)
}

class CompanionParser {
    private readonly functionDeclarationParser: FunctionDeclarationParser
    private readonly variableDeclarationParser: VariableDeclarationParser

    private constructor(context: Context) {
        this.functionDeclarationParser =
            FunctionDeclarationParser.create(context)
        this.variableDeclarationParser =
            VariableDeclarationParser.create(context)
    }

    static create(context: Context): CompanionParser {
        return new CompanionParser(context)
    }

    parse(stream: TokenStream) {
        const startToken = stream.expect('KEYWORD', 'companion')
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        stream.expect('PUNCTUATION', '{')
        const fields: VariableDeclaration[] = []
        const methods: FunctionDeclaration[] = []

        while (!stream.isNext('PUNCTUATION', '}')) {
            if (this.variableDeclarationParser.isNext(stream)) {
                fields.push(this.variableDeclarationParser.parse(stream))
            }

            if (this.functionDeclarationParser.isNext(stream)) {
                methods.push(this.functionDeclarationParser.parse(stream))
            }
        }
        const endToken = stream.expect('PUNCTUATION', '}')
        return Companion.create({
            name,
            fields,
            methods,
            span: { start: startToken.start, end: endToken.end },
        })
    }
}
