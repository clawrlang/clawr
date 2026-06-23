import { TokenStream } from '../lexer'
import { DataDeclaration } from '../model'

export class DataDeclarationParser {
    private constructor(private stream: TokenStream) {}

    static create({
        tokenStream,
    }: {
        tokenStream: TokenStream
    }): DataDeclarationParser {
        return new DataDeclarationParser(tokenStream)
    }

    parse(): DataDeclaration {
        this.stream.expect('KEYWORD', 'data')
        const nameToken = this.stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        this.stream.expect('PUNCTUATION', '{')
        const fields: { name: string; type: string }[] = []
        while (!this.stream.isNext('PUNCTUATION', '}')) {
            const fieldNameToken = this.stream.expect('IDENTIFIER')
            const fieldName = fieldNameToken.identifier
            this.stream.expect('PUNCTUATION', ':')
            const fieldTypeToken = this.stream.expect('IDENTIFIER')
            const fieldType = fieldTypeToken.identifier
            fields.push({ name: fieldName, type: fieldType })
        }
        this.stream.expect('PUNCTUATION', '}')
        return DataDeclaration.create({ name, fields })
    }
}
