import { TokenStream } from '@/lexer'
import { LoopStatement } from '@/model/loop-statement'
import { Context } from '@/parser'
import { BlockParser } from '@/parser/block-parser'
import { ExpressionParser } from '@/parser/expression-parser'
import { StatementParser } from '@/parser/statement-parser'

export class LoopStatementParser implements StatementParser<LoopStatement> {
    private constructor(private readonly context: Context) {}

    static create(context: Context): LoopStatementParser {
        return new LoopStatementParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'while', 'repeat')
    }

    parse(stream: TokenStream): LoopStatement {
        const keyword = stream.expect('KEYWORD', 'while', 'repeat').keyword
        const expression = ExpressionParser.create(this.context)
        const block = BlockParser.create(this.context)
        if (keyword === 'while') {
            const condition = expression.parse(stream)
            return LoopStatement.create({
                condition,
                body: block.parse(stream),
                testAfter: false,
            })
        }
        const body = block.parse(stream)
        stream.expect('KEYWORD', 'while')
        return LoopStatement.create({
            condition: expression.parse(stream),
            body,
            testAfter: true,
        })
    }
}
