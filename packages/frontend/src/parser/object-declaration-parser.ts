import { TokenStream } from '@/lexer'
import { Property } from '@/model/data-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { ObjectDeclaration } from '@/model/object-declaration'
import { TypeName } from '@/model/type-name'
import { Context } from '@/parser'
import { FunctionDeclarationParser } from '@/parser/function-declaration-parser'
import { PropertyParser } from '@/parser/property-parser'
import { SourceError } from '@/tools'

export class ObjectDeclarationParser {
    private readonly functionParser: FunctionDeclarationParser

    private constructor(private context: Context) {
        this.functionParser = FunctionDeclarationParser.create(context)
    }

    static create(context: Context): ObjectDeclarationParser {
        return new ObjectDeclarationParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'object', 'service', 'opaque')
    }

    parse(stream: TokenStream): ObjectDeclaration {
        const opaqueToken = stream.isNext('KEYWORD', 'opaque')
            ? stream.expect('KEYWORD', 'opaque')
            : undefined
        const startToken = opaqueToken
            ? stream.expect('KEYWORD', 'service')
            : stream.expect('KEYWORD', 'object', 'service')
        const nameToken = stream.expect('IDENTIFIER')

        const inherits: string[] = []

        if (stream.isNext('PUNCTUATION', ':')) {
            stream.expect('PUNCTUATION', ':')
            do {
                const token = stream.expect('IDENTIFIER')
                inherits.push(token.identifier)
                this.context.definitionRecorder?.typeReference(
                    token.identifier,
                    {
                        start: token.start,
                        end: token.end,
                    },
                )
            } while (stream.isNext('PUNCTUATION', ',') && stream.next())
        }

        stream.expect('PUNCTUATION', '{')

        const readonly = this.parseMethods(stream, !!opaqueToken)
        let mutating: FunctionDeclaration[] | undefined
        let initializers: FunctionDeclaration[] | undefined
        let properties: Property[] | undefined

        while (!stream.isNext('PUNCTUATION', '}')) {
            if (stream.isNext('KEYWORD', 'state')) {
                const dataToken = stream.expect('KEYWORD', 'state')
                stream.expect('PUNCTUATION', ':')
                if (properties)
                    throw SourceError.create({
                        message: `Repeated state section`,
                        span: { ...dataToken },
                    })
                properties = this.parseProperties(stream)
            }
            if (stream.isNext('KEYWORD', 'init')) {
                const inheritanceToken = stream.expect('KEYWORD', 'init')
                stream.expect('PUNCTUATION', ':')
                if (initializers)
                    throw SourceError.create({
                        message: `Repeated init section`,
                        span: { ...inheritanceToken },
                    })
                initializers = this.parseMethods(stream)
            }
            if (stream.isNext('KEYWORD', 'mutating')) {
                const mutatingToken = stream.expect('KEYWORD', 'mutating')
                stream.expect('PUNCTUATION', ':')
                if (mutating)
                    throw SourceError.create({
                        message: `Repeated mutating section`,
                        span: { ...mutatingToken },
                    })
                mutating = this.parseMethods(stream)
            }
        }

        const endToken = stream.expect('PUNCTUATION', '}')
        return ObjectDeclaration.create({
            kind: startToken.keyword as 'object' | 'service',
            name: TypeName.create({
                name: nameToken.identifier,
                namespace: opaqueToken
                    ? this.context.scope?.namespace
                    : undefined,
            }),
            opaque: !!opaqueToken,
            nameSpan: { start: nameToken.start, end: nameToken.end },
            inherits,
            readonly,
            mutating: mutating ?? [],
            initializers: initializers ?? [],
            properties: properties ?? [],
            span: {
                start: startToken.start,
                end: endToken.end,
            },
        })
    }

    parseMethods(
        stream: TokenStream,
        allowExtern = false,
    ): FunctionDeclaration[] {
        const methods: FunctionDeclaration[] = []

        while (!this.isSectionEnd(stream))
            methods.push(this.functionParser.parse(stream, { allowExtern }))

        return methods
    }

    private parseProperties(stream: TokenStream) {
        const properties: Property[] = []
        const propertyParser = PropertyParser.create({})

        while (!this.isSectionEnd(stream))
            properties.push(propertyParser.parse(stream))

        return properties
    }

    private isSectionEnd(stream: TokenStream) {
        return (
            stream.isNext('PUNCTUATION', '}') ||
            stream.isNext('KEYWORD', 'state') ||
            stream.isNext('KEYWORD', 'mutating') ||
            stream.isNext('KEYWORD', 'init')
        )
    }
}
