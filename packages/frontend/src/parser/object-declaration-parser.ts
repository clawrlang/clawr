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
            name: TypeName.create({ name: nameToken.identifier }),
            superType,
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

    parseMethods(stream: TokenStream): FunctionDeclaration[] {
        const methods: FunctionDeclaration[] = []

        while (!this.isSectionEnd(stream))
            methods.push(this.functionParser.parse(stream))

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
