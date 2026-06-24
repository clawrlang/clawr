import { ExpressionParser } from '.'
import { TokenStream } from '../lexer'
import { DataLiteral } from '../model'

export class DataLiteralParser {
    constructor(private tokenStream: TokenStream) {}

    static create({ tokenStream }: { tokenStream: TokenStream }) {
        return new DataLiteralParser(tokenStream)
    }

    parse(): DataLiteral {
        const fields: DataLiteral['fields'] = []
        this.tokenStream.expect('PUNCTUATION', '{')
        while (!this.tokenStream.isNext('PUNCTUATION', '}')) {
            const key = this.tokenStream.expect('IDENTIFIER').identifier
            this.tokenStream.expect('PUNCTUATION', ':')
            fields.push({
                name: key,
                value: ExpressionParser.create(this.tokenStream).parse(),
            })
        }
        this.tokenStream.expect('PUNCTUATION', '}')
        return new DataLiteral(fields)
    }
}
