import { ExpressionParser } from './expression.parser'
import { TokenStream } from '../lexer'
import { DataLiteral } from '../model/data-literal'

export class DataLiteralParser {
    constructor() {}

    static create() {
        return new DataLiteralParser()
    }

    parse(stream: TokenStream): DataLiteral {
        const fields: DataLiteral['fields'] = []
        stream.expect('PUNCTUATION', '{')
        while (!stream.isNext('PUNCTUATION', '}')) {
            const key = stream.expect('IDENTIFIER').identifier
            stream.expect('PUNCTUATION', ':')
            fields.push({
                name: key,
                value: ExpressionParser.create().parse(stream),
            })
        }
        stream.expect('PUNCTUATION', '}')
        return new DataLiteral(fields)
    }
}
