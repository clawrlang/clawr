import { ExpressionParser } from './expression-parser'
import { TokenStream } from '@/lexer'
import { DataLiteral } from '@/model/data-literal'
import { Context } from '.'
import { FunctionCall } from '@/model/function-call'

export class DataLiteralParser {
    private constructor(private expressionParser: ExpressionParser) {}

    static create(
        context: Context,
        options?: {
            expressionParser: ExpressionParser
        },
    ) {
        return new DataLiteralParser(
            options?.expressionParser ?? ExpressionParser.create(context),
        )
    }

    parse(stream: TokenStream): DataLiteral {
        const fields: DataLiteral['fields'] = []
        const startToken = stream.expect('PUNCTUATION', '{')

        const initializerCall = stream.attempt((clone) => {
            try {
                const expr = this.expressionParser.parse(clone)
                return expr instanceof FunctionCall ? expr : undefined
            } catch {
                return undefined
            }
        })
        while (!stream.isNext('PUNCTUATION', '}')) {
            const key = stream.expect('IDENTIFIER').identifier
            stream.expect('PUNCTUATION', ':')
            fields.push({
                name: key,
                value: this.expressionParser.parse(stream),
            })
            if (stream.isNext('PUNCTUATION', ',')) {
                stream.next()
            } else if (!stream.isNext('NEWLINE')) {
                break
            }
        }
        const endToken = stream.expect('PUNCTUATION', '}')
        return DataLiteral.create({
            fields,
            initializerCall,
            span: {
                start: startToken.start,
                end: endToken.end,
            },
        })
    }
}
