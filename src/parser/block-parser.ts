import { TokenStream } from '../lexer'
import { Statement } from '../model'
import { CallFuncParser } from './call-func-parser'
import { StatementParser } from './statement-parser'
import { VariableDeclarationParser } from './variable-declaration-parser'

export class BlockParser {
    private statementParsers: StatementParser<Statement>[]

    private constructor() {
        this.statementParsers = [
            CallFuncParser.create(),
            VariableDeclarationParser.create(),
        ]
    }

    static create(): BlockParser {
        return new BlockParser()
    }

    parse(stream: TokenStream): Statement[] {
        const statements: Statement[] = []
        stream.expect('PUNCTUATION', '{')
        while (!stream.isNext('PUNCTUATION', '}'))
            statements.push(this.nextParser(stream).parse(stream))

        stream.expect('PUNCTUATION', '}')
        return statements
    }

    private nextParser(stream: TokenStream): StatementParser<Statement> {
        const parser = this.statementParsers.find((parser) =>
            parser.isNext(stream),
        )
        if (!parser) throw new Error('No suitable parser found')
        return parser
    }
}
