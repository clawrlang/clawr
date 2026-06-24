import { TokenStream } from '../lexer'
import { DataDeclaration } from '../model'

export class DataDeclarationParser {
    private constructor() {}

    static create(): DataDeclarationParser {
        return new DataDeclarationParser()
    }

    parse(stream: TokenStream): DataDeclaration {
        stream.expect('KEYWORD', 'data')
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        stream.expect('PUNCTUATION', '{')
        const fields: { name: string; type: string }[] = []
        while (!stream.isNext('PUNCTUATION', '}')) {
            const fieldNameToken = stream.expect('IDENTIFIER')
            const fieldName = fieldNameToken.identifier
            stream.expect('PUNCTUATION', ':')
            const fieldTypeToken = stream.expect('IDENTIFIER')
            const fieldType = fieldTypeToken.identifier
            fields.push({ name: fieldName, type: fieldType })
        }
        stream.expect('PUNCTUATION', '}')
        return DataDeclaration.create({ name, fields })
    }
}
