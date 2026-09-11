import { TokenStream } from '@/lexer'
import { Statement } from '@/model'
import { FunctionCall } from '@/model/function-call'
import { Context } from '.'
import { StatementParser } from './statement-parser'
import { ExpressionParser } from './expression-parser'

export class FunctionCallParser implements StatementParser<Statement> {
    private constructor(private context: Context) {}

    static create(context: Context): FunctionCallParser {
        return new FunctionCallParser(context)
    }

    isNext(stream: TokenStream): boolean {
        const clone = stream.clone()
        try {
            clone.expect('IDENTIFIER')
            while (clone.isNext('OPERATOR', '.', '->')) {
                clone.next()
                clone.expect('IDENTIFIER')
            }
            clone.expect('PUNCTUATION', '(')
            return true
        } catch {
            return false
        }
    }

    parse(stream: TokenStream): Statement {
        const expressionParser = ExpressionParser.create(this.context)
        const expr = expressionParser.parse(stream)
        if (expr instanceof FunctionCall) return expr
        throw new Error('not a function call')
    }
}
