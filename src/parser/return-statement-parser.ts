import { Context } from '.'
import { TokenStream } from '../lexer'
import { ReturnStatement } from '../model/return-statement'
import { ExpressionParser } from './expression-parser'
import { StatementParser } from './statement-parser'

export class ReturnStatementParser implements StatementParser<ReturnStatement> {
    private constructor(private context: Context) {}

    static create(context: Context): ReturnStatementParser {
        return new ReturnStatementParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'return')
    }

    parse(stream: TokenStream) {
        const keywordToken = stream.expect('KEYWORD', 'return')
        if (stream.isNext('NEWLINE') || stream.isNext('PUNCTUATION', '}'))
            return ReturnStatement.create({
                span: { start: keywordToken.start, end: keywordToken.end },
            })
        else {
            const value = this.parseExpression(stream)
            return ReturnStatement.create({
                value,
                span: { start: keywordToken.start, end: value.span.end },
            })
        }
    }

    private parseExpression(stream: TokenStream) {
        return ExpressionParser.create(this.context).parse(stream)
    }
}
