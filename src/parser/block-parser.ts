import { Context } from '.'
import { TokenStream } from '../lexer'
import { Statement } from '../model'
import { AssignmentParser } from './assignment-parser'
import { CallFuncParser } from './call-func-parser'
import { ReturnStatementParser } from './return-statement-parser'
import { StatementParser } from './statement-parser'
import { VariableDeclarationParser } from './variable-declaration-parser'

export class BlockParser {
    private statementParsers: StatementParser<Statement>[]
    private context: Context

    private constructor(context: Context) {
        this.context = context
        this.statementParsers = [
            CallFuncParser.create(context),
            VariableDeclarationParser.create(context),
            AssignmentParser.create(context),
            ReturnStatementParser.create(context),
        ]
    }

    static create(context: Context): BlockParser {
        return new BlockParser(context)
    }

    parse(stream: TokenStream): Statement[] {
        const statements: Statement[] = []
        stream.expect('PUNCTUATION', '{')
        while (!stream.isNext('PUNCTUATION', '}')) {
            if (!stream.peek()) stream.expect('PUNCTUATION', '}')

            statements.push(this.nextParser(stream).parse(stream))
        }

        stream.expect('PUNCTUATION', '}')
        return statements
    }

    private nextParser(stream: TokenStream): StatementParser<Statement> {
        const parser = this.statementParsers.find((parser) =>
            parser.isNext(stream),
        )
        if (!parser) {
            const { start, end } = stream.peek()!!
            this.context.errorReporter.reportFatalError(
                'No suitable parser found for the next statement',
                { start, end },
            )
        }
        return parser
    }
}
