import { ExpressionParser } from './expression.parser'
import { TokenStream } from '../lexer'
import { DataLiteral } from '../model/data-literal'

export class DataLiteralParser {
    constructor(private expressionParser: ExpressionParser) {}

    static create(expressionParser: ExpressionParser) {
        return new DataLiteralParser(expressionParser)
    }

    parse(stream: TokenStream): DataLiteral {
        const fields: DataLiteral['fields'] = []
        stream.expect('PUNCTUATION', '{')
        while (!stream.isNext('PUNCTUATION', '}')) {
            const key = stream.expect('IDENTIFIER').identifier
            stream.expect('PUNCTUATION', ':')
            fields.push({
                name: key,
                value: this.expressionParser.parse(stream),
            })
        }
        stream.expect('PUNCTUATION', '}')
        return DataLiteral.create(fields)
    }
}
