import { TokenStream } from '@/lexer'
import { Statement } from '@/model'
import { StatementParser } from './statement-parser'
import { CallFunc } from '@/model/call-func'
import { Context } from '.'
import { FunctionArgumentsParser } from './function-arguments-parser'

export class CallFuncParser implements StatementParser<Statement> {
    private constructor(private context: Context) {}

    static create(context: Context): CallFuncParser {
        return new CallFuncParser(context)
    }

    isNext(stream: TokenStream): boolean {
        const clone = stream.clone()
        try {
            clone.expect('IDENTIFIER')
            clone.expect('PUNCTUATION', '(')
            return true
        } catch {
            return false
        }
    }

    parse(stream: TokenStream): Statement {
        const nameToken = stream.expect('IDENTIFIER')

        const args = FunctionArgumentsParser.create(this.context).parse(stream)
        return CallFunc.create({
            baseName: nameToken.identifier,
            arguments: args.arguments,
        })
    }
}
