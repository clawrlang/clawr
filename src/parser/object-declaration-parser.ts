import { TokenStream } from '../lexer'
import { Context } from '.'
import { DataField } from '../model/data-declaration'
import { FunctionDeclaration } from '../model/function-declaration'
import { ObjectDeclaration } from '../model/object-declaration'
import { DataFieldParser } from './data-field-parser'
import { FunctionDeclarationParser } from './function-declaration-parser'

export class ObjectDeclarationParser {
    private readonly functionParser: FunctionDeclarationParser

    private constructor(private context: Context) {
        this.functionParser = FunctionDeclarationParser.create(context)
    }

    static create(context: Context): ObjectDeclarationParser {
        return new ObjectDeclarationParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'object', 'service')
    }

    parse(stream: TokenStream): ObjectDeclaration {
        const startToken = stream.expect('KEYWORD', 'object', 'service')
        const nameToken = stream.expect('IDENTIFIER')

        let superType: string | undefined

        if (stream.isNext('PUNCTUATION', ':')) {
            stream.expect('PUNCTUATION', ':')
            superType = stream.expect('IDENTIFIER').identifier
        }

        stream.expect('PUNCTUATION', '{')

        const readonly = this.parseMethods(stream)
        let mutating: FunctionDeclaration[] | undefined
        let inheritance: FunctionDeclaration[] | undefined
        let fields: DataField[] | undefined

        while (!stream.isNext('PUNCTUATION', '}')) {
            if (stream.isNext('KEYWORD', 'state')) {
                const dataToken = stream.expect('KEYWORD', 'state')
                stream.expect('PUNCTUATION', ':')
                if (fields)
                    this.context.errorReporter.reportFatalError(
                        `Repeated state section`,
                        { ...dataToken },
                    )
                fields = this.parseFields(stream)
            }
            if (stream.isNext('KEYWORD', 'inheritance')) {
                const inheritanceToken = stream.expect('KEYWORD', 'inheritance')
                stream.expect('PUNCTUATION', ':')
                if (inheritance)
                    this.context.errorReporter.reportFatalError(
                        `Repeated inheritance section`,
                        { ...inheritanceToken },
                    )
                inheritance = this.parseMethods(stream)
            }
            if (stream.isNext('KEYWORD', 'mutating')) {
                const mutatingToken = stream.expect('KEYWORD', 'mutating')
                stream.expect('PUNCTUATION', ':')
                if (mutating)
                    this.context.errorReporter.reportFatalError(
                        `Repeated mutating section`,
                        { ...mutatingToken },
                    )
                mutating = this.parseMethods(stream)
            }
        }

        const endToken = stream.expect('PUNCTUATION', '}')
        return ObjectDeclaration.create({
            kind: startToken.keyword as 'object' | 'service',
            name: nameToken.identifier,
            superType,
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
        const fieldParser = DataFieldParser.create({
            errorReporter: this.context.errorReporter,
        })

        while (!this.isSectionEnd(stream))
            fields.push(fieldParser.parse(stream))

        return fields
    }

    private isSectionEnd(stream: TokenStream) {
        return (
            stream.isNext('PUNCTUATION', '}') ||
            stream.isNext('KEYWORD', 'state') ||
            stream.isNext('KEYWORD', 'mutating') ||
            stream.isNext('KEYWORD', 'inheritance')
        )
    }
}
