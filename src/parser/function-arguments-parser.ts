import { Context } from '.'
import { TokenStream } from '../lexer'
import { Expression } from '../model'
import { ExpressionParser } from './expression-parser'

export class FunctionArgumentsParser {
    private constructor(private context: Context) {}

    static create(context: Context): FunctionArgumentsParser {
        return new FunctionArgumentsParser(context)
    }

    parse(stream: TokenStream): { label?: string; value: Expression }[] {
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
            const arg = ExpressionParser.create(this.context).parse(stream)
            args.push({ label: label?.label, value: arg })

            if (stream.isNext('PUNCTUATION', ')')) {
                stream.next()
                break
            }

            stream.expect('PUNCTUATION', ',')
        }
        return args
    }
}
