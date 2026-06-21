import { ExpressionParser } from '.'
import { Expression, Statement } from '../cir'
import { TokenStream } from '../lexer'

export class CallParser {
    private constructor(private tokenStream: TokenStream) {}

    static create(tokenStream: TokenStream): CallParser {
        return new CallParser(tokenStream)
    }

    parse(): Statement {
        const nameToken = this.tokenStream.expect('IDENTIFIER')
        this.tokenStream.expect('PUNCTUATION', '(')
        const args: Expression[] = []

        while (!this.tokenStream.isNext('PUNCTUATION', ')', ',')) {
            const arg = ExpressionParser.create(this.tokenStream).parse()
            args.push(arg.toCir())

            if (this.tokenStream.isNext('PUNCTUATION', ')')) {
                this.tokenStream.next() // Consume the closing parenthesis
                break
            }

            this.tokenStream.expect('PUNCTUATION', ',')
        }
        return {
            type: 'CALL_FUNC',
            signature: {
                baseName:
                    nameToken.identifier == 'print'
                        ? `print${args[0].type === 'INTEGER_LITERAL' ? 'Integer' : 'Truthvalue'}`
                        : nameToken.identifier,
                parameters: args.map((arg) => {
                    switch (arg.type) {
                        case 'INTEGER_LITERAL':
                            return { type: 'integer' }
                        case 'TRUTHVALUE_LITERAL':
                            return { type: 'truthvalue' }
                        default:
                            throw new Error(
                                `Unsupported argument type: ${arg.type}`,
                            )
                    }
                }),
            },
            arguments: args,
        }
    }
}
