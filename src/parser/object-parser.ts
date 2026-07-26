import { TestErrorReporter } from '../../tests/util'
import { TokenStream } from '../lexer'
import { FunctionDeclaration } from '../model/function-declaration'
import { ObjectDeclaration } from '../model/object-declaration'
import { FunctionParser } from './function-parser'

export class ObjectParser {
    private readonly functionParser: FunctionParser

    private constructor(private errorReporter: TestErrorReporter) {
        this.functionParser = FunctionParser.create({
            errorReporter: this.errorReporter,
        })
    }

    static create({ errorReporter }: { errorReporter: TestErrorReporter }) {
        return new ObjectParser(errorReporter)
    }

    parse(stream: TokenStream) {
        const startToken = stream.expect('KEYWORD', 'object')
        const nameToken = stream.expect('IDENTIFIER')
        stream.expect('PUNCTUATION', '{')

        const readonly: any[] = this.parseMethods(stream)
        const mutating: any[] = []

        let fields: any[] | undefined
        if (stream.isNext('KEYWORD', 'data')) fields = this.parseFields(stream)
        if (stream.isNext('KEYWORD', 'mutating')) {
            stream.expect('KEYWORD', 'mutating')
            stream.expect('PUNCTUATION', ':')
            mutating.push(...this.parseMethods(stream))
        }

        const endToken = stream.expect('PUNCTUATION', '}')
        return ObjectDeclaration.create({
            name: nameToken.identifier,
            readonly,
            mutating,
            fields: fields ?? [],
            span: {
                start: startToken.start,
                end: endToken.end,
            },
        })
    }

    parseMethods(stream: TokenStream): FunctionDeclaration[] {
        const methods: FunctionDeclaration[] = []

        while (!this.isSectionEnd(stream))
            methods.push(this.functionParser.parse(stream))

        return methods
    }

    private parseFields(stream: TokenStream) {
        stream.expect('KEYWORD', 'data')
        stream.expect('PUNCTUATION', ':')
        const fields: any[] = []

        while (!this.isSectionEnd(stream)) {
            const fieldNameToken = stream.expect('IDENTIFIER')
            stream.expect('PUNCTUATION', ':')
            const fieldTypeToken = stream.expect('IDENTIFIER')

            fields.push({
                name: fieldNameToken.identifier,
                type: fieldTypeToken.identifier,
            })
        }
        return fields
    }

    private isSectionEnd(stream: TokenStream) {
        return (
            stream.isNext('PUNCTUATION', '}') ||
            stream.isNext('KEYWORD', 'data') ||
            stream.isNext('KEYWORD', 'mutating')
        )
    }
}
