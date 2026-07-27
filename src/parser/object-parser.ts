import { TestErrorReporter } from '../../tests/util'
import { TokenStream } from '../lexer'
import { DataField } from '../model/data-declaration'
import { FunctionDeclaration } from '../model/function-declaration'
import { ObjectDeclaration } from '../model/object-declaration'
import { FunctionParser } from './function-parser'
import { ValueSetParser } from './value-set-parser'

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

        const readonly = this.parseMethods(stream)
        let mutating: FunctionDeclaration[] | undefined
        let inheritance: FunctionDeclaration[] | undefined
        let fields: DataField[] | undefined

        while (!stream.isNext('PUNCTUATION', '}')) {
            if (stream.isNext('KEYWORD', 'data')) {
                const dataToken = stream.expect('KEYWORD', 'data')
                stream.expect('PUNCTUATION', ':')
                if (fields)
                    this.errorReporter.reportFatalError(
                        `Repeated data section`,
                        { ...dataToken },
                    )
                fields = this.parseFields(stream)
            }
            if (stream.isNext('KEYWORD', 'inheritance')) {
                const inheritanceToken = stream.expect('KEYWORD', 'inheritance')
                stream.expect('PUNCTUATION', ':')
                if (inheritance)
                    this.errorReporter.reportFatalError(
                        `Repeated inheritance section`,
                        { ...inheritanceToken },
                    )
                inheritance = this.parseMethods(stream)
            }
            if (stream.isNext('KEYWORD', 'mutating')) {
                const mutatingToken = stream.expect('KEYWORD', 'mutating')
                stream.expect('PUNCTUATION', ':')
                if (mutating)
                    this.errorReporter.reportFatalError(
                        `Repeated mutating section`,
                        { ...mutatingToken },
                    )
                mutating = this.parseMethods(stream)
            }
        }

        const endToken = stream.expect('PUNCTUATION', '}')
        return ObjectDeclaration.create({
            name: nameToken.identifier,
            readonly,
            mutating: mutating ?? [],
            inheritance: inheritance ?? [],
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
        const fields: DataField[] = []

        while (!this.isSectionEnd(stream)) {
            const fieldNameToken = stream.expect('IDENTIFIER')
            stream.expect('PUNCTUATION', ':')

            fields.push({
                name: fieldNameToken.identifier,
                valueSet: ValueSetParser.create({
                    errorReporter: this.errorReporter,
                }).parse(stream),
                semantics: 'mut',
            })
        }
        return fields
    }

    private isSectionEnd(stream: TokenStream) {
        return (
            stream.isNext('PUNCTUATION', '}') ||
            stream.isNext('KEYWORD', 'data') ||
            stream.isNext('KEYWORD', 'mutating') ||
            stream.isNext('KEYWORD', 'inheritance')
        )
    }
}
