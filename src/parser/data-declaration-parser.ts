import { Context } from '.'
import { TokenStream } from '../lexer'
import { DataDeclaration, DataField } from '../model/data-declaration'
import { TypeName } from '../model/type-name'
import { DataFieldParser } from './data-field-parser'

export class DataDeclarationParser {
    private constructor(private context: Context) {}

    static create(context: Context): DataDeclarationParser {
        return new DataDeclarationParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'data')
    }

    parse(stream: TokenStream): DataDeclaration {
        const fieldParser = DataFieldParser.create(this.context)

        stream.expect('KEYWORD', 'data')
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        stream.expect('PUNCTUATION', '{')
        const fields: DataField[] = []
        while (!stream.isNext('PUNCTUATION', '}')) {
            fields.push(fieldParser.parse(stream))
        }
        stream.expect('PUNCTUATION', '}')
        return DataDeclaration.create({
            name: TypeName.create({ name }),
            fields,
        })
    }
}
