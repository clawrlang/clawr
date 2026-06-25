import { ErrorReporter } from '../diagnostics'
import { TokenStream } from '../lexer'
import { Statement } from '../model'
import { CallFuncParser } from './call-func-parser'
import { StatementParser } from './statement-parser'
import { VariableDeclarationParser } from './variable-declaration-parser'

export class BlockParser {
    private statementParsers: StatementParser<Statement>[]
    private errorReporter: ErrorReporter

    private constructor(errorReporter: ErrorReporter) {
        this.errorReporter = errorReporter
        this.statementParsers = [
            CallFuncParser.create({ errorReporter }),
            VariableDeclarationParser.create({ errorReporter }),
        ]
    }

    static create({
        errorReporter,
    }: {
        errorReporter: ErrorReporter
    }): BlockParser {
        return new BlockParser(errorReporter)
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
            this.errorReporter.reportFatalError(
                'No suitable parser found for the next statement',
                { start, end },
            )
        }
        return parser
    }
}
