import { TokenStream } from '@/lexer'
import { DataDeclaration, Property } from '@/model/data-declaration'
import { TypeName } from '@/model/type-name'
import { Context } from '@/parser'
import { PropertyParser } from '@/parser/property-parser'

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
        stream.expect('PUNCTUATION', '{')
        const properties: Property[] = []
        while (!stream.isNext('PUNCTUATION', '}')) {
            properties.push(propertyParser.parse(stream))
        }
        stream.expect('PUNCTUATION', '}')
        return DataDeclaration.create({
            name: TypeName.create({ name }),
            properties: properties,
        })
    }
}
