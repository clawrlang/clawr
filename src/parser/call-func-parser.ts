import { ExpressionParser } from '.'
import { TokenStream } from '../lexer'
import { CallFunc, Expression } from '../model'

export class CallFuncParser {
    private constructor(private tokenStream: TokenStream) {}

    static create(tokenStream: TokenStream): CallFuncParser {
        return new CallFuncParser(tokenStream)
    }

    parse(): CallFunc {
        const nameToken = this.tokenStream.expect('IDENTIFIER')
        this.tokenStream.expect('PUNCTUATION', '(')
        const args: Expression[] = []

        while (!this.tokenStream.isNext('PUNCTUATION', ')', ',')) {
            const arg = ExpressionParser.create(this.tokenStream).parse()
            args.push(arg)

            if (this.tokenStream.isNext('PUNCTUATION', ')')) {
                this.tokenStream.next()
                break
            }

            this.tokenStream.expect('PUNCTUATION', ',')
        }
        return CallFunc.create({
            baseName: nameToken.identifier,
            arguments: args.map((arg) => ({
                value: arg,
            })),
        })
    }
}
