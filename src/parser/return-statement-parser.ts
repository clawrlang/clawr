import { Context } from '.'
import { ErrorReporter } from '../diagnostics'
import { TokenStream } from '../lexer'
import { ReturnStatement } from '../model/return-statement'
import { ExpressionParser } from './expression-parser'
import { StatementParser } from './statement-parser'

export class ReturnStatementParser implements StatementParser<ReturnStatement> {
    private constructor(private errorReporter: ErrorReporter) {}

    static create(context: Context): ReturnStatementParser {
        return new ReturnStatementParser(context.errorReporter)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'return')
    }

    parse(stream: TokenStream) {
        stream.expect('KEYWORD', 'return')
        return stream.isNext('NEWLINE') || stream.isNext('PUNCTUATION', '}')
            ? ReturnStatement.create(undefined)
            : ReturnStatement.create(this.parseExpression(stream))
    }

    private parseExpression(stream: TokenStream) {
        return ExpressionParser.create({
            errorReporter: this.errorReporter,
        }).parse(stream)
    }
}
