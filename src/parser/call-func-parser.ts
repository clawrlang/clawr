import { ExpressionParser } from '.'
import { TokenStream } from '../lexer'
import { CallFunc, Expression, Statement } from '../model'

export class CallFuncParser {
    private constructor(private tokenStream: TokenStream) {}

    static create(tokenStream: TokenStream): CallFuncParser {
        return new CallFuncParser(tokenStream)
    }

    parse(): Statement {
        const nameToken = this.tokenStream.expect('IDENTIFIER')
        this.tokenStream.expect('PUNCTUATION', '(')
        const args: { label?: string; value: Expression }[] = []

        while (!this.tokenStream.isNext('PUNCTUATION', ')', ',')) {
            const label = this.tokenStream.attempt((clone) => {
                try {
                    const labelToken = clone.expect('IDENTIFIER')
                    clone.expect('PUNCTUATION', ':')
                    return { label: labelToken.identifier }
                } catch {
                    return null
                }
            })
            const arg = ExpressionParser.create(this.tokenStream).parse()
            args.push({ label: label?.label, value: arg })

            if (this.tokenStream.isNext('PUNCTUATION', ')')) {
                this.tokenStream.next()
                break
            }

            this.tokenStream.expect('PUNCTUATION', ',')
        }
        return CallFunc.create({
            baseName: nameToken.identifier,
            arguments: args,
        })
    }
}
