import { ExpressionParser } from './expression.parser'
import { TokenStream } from '../lexer'
import { Expression, Statement } from '../model'
import { StatementParser } from './statement-parser'
import { CallFunc } from '../model/call-func'

export class CallFuncParser implements StatementParser<Statement> {
    private constructor() {}

    static create(): CallFuncParser {
        return new CallFuncParser()
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('IDENTIFIER')
    }

    parse(stream: TokenStream): Statement {
        const nameToken = stream.expect('IDENTIFIER')
        stream.expect('PUNCTUATION', '(')
        const args: { label?: string; value: Expression }[] = []

        while (!stream.isNext('PUNCTUATION', ')', ',')) {
            const label = stream.attempt((clone) => {
                try {
                    const labelToken = clone.expect('IDENTIFIER')
                    clone.expect('PUNCTUATION', ':')
                    return { label: labelToken.identifier }
                } catch {
                    return null
                }
            })
            const arg = ExpressionParser.create().parse(stream)
            args.push({ label: label?.label, value: arg })

            if (stream.isNext('PUNCTUATION', ')')) {
                stream.next()
                break
            }

            stream.expect('PUNCTUATION', ',')
        }
        return CallFunc.create({
            baseName: nameToken.identifier,
            arguments: args,
        })
    }
}
