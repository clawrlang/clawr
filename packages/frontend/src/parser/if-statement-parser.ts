import { TokenStream } from '@/lexer'
import { IfStatement } from '@/model/if-statement'
import { Context } from '@/parser'
import { BlockParser } from '@/parser/block-parser'
import { ExpressionParser } from '@/parser/expression-parser'
import { StatementParser } from '@/parser/statement-parser'

export class IfStatementParser implements StatementParser<IfStatement> {
    private constructor(private readonly context: Context) {}

    static create(context: Context): IfStatementParser {
        return new IfStatementParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'if')
    }

    parse(stream: TokenStream): IfStatement {
        stream.expect('KEYWORD', 'if')
        const condition = ExpressionParser.create(this.context).parse(stream)
        const then = BlockParser.create(this.context).parse(stream)
        let otherwise: IfStatement['otherwise']
        if (stream.isNext('KEYWORD', 'else')) {
            stream.expect('KEYWORD', 'else')
            otherwise = this.isNext(stream)
                ? [this.parse(stream)]
                : BlockParser.create(this.context).parse(stream)
        }
        return IfStatement.create({ condition, then, otherwise })
    }
}
