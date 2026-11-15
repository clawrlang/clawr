import { TokenStream } from '@/lexer'
import { DataDeclaration, Property } from '@/model/data-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { TypeName } from '@/model/type-name'
import { Context } from '@/parser'
import { FunctionDeclarationParser } from '@/parser/function-declaration-parser'
import { PropertyParser } from '@/parser/property-parser'
import { SourceError } from '@/tools'

export class DataDeclarationParser {
    private constructor(private context: Context) {}

    static create(context: Context): DataDeclarationParser {
        return new DataDeclarationParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'data')
    }

    parse(stream: TokenStream): DataDeclaration {
        const propertyParser = PropertyParser.create(this.context)

        stream.expect('KEYWORD', 'data')
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        let explicitlySerializable = false
        if (stream.isNext('PUNCTUATION', ':')) {
            stream.expect('PUNCTUATION', ':')
            const trait = stream.expect('IDENTIFIER')
            if (trait.identifier !== 'JSONSerializable')
                throw SourceError.create({
                    message: 'Data types only support the JSONSerializable trait',
                    span: { start: trait.start, end: trait.end },
                })
            explicitlySerializable = true
        }
        stream.expect('PUNCTUATION', '{')
        const properties: Property[] = []
        let serializer: FunctionDeclaration | undefined
        while (
            !stream.isNext('PUNCTUATION', '}') &&
            !stream.isNext('KEYWORD', 'serialize')
        ) {
            properties.push(propertyParser.parse(stream))
        }
        if (stream.isNext('KEYWORD', 'serialize')) {
            const section = stream.expect('KEYWORD', 'serialize')
            if (!explicitlySerializable)
                throw SourceError.create({
                    message:
                        'A custom data serializer requires JSONSerializable conformance',
                    span: { start: section.start, end: section.end },
                })
            stream.expect('PUNCTUATION', ':')
            serializer = FunctionDeclarationParser.create(this.context).parse(
                stream,
                { allowExtern: false },
            )
        }
        const endToken = stream.expect('PUNCTUATION', '}')
        return DataDeclaration.create({
            name: TypeName.create({ name }),
            properties: properties,
            explicitlySerializable,
            serializer,
            span: { start: nameToken.start, end: endToken.end },
        })
    }
}
