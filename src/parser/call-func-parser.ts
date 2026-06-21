import { IntegerLiteralParser, TruthvalueLiteralParser } from '.'
import { Expression } from '../cir'
import { TokenStream } from '../lexer'

export class CallParser {
    private constructor(private tokenStream: TokenStream) {}

    static create(tokenStream: TokenStream): CallParser {
        return new CallParser(tokenStream)
    }

    parse() {
        const nameToken = this.tokenStream.expect('IDENTIFIER')
        this.tokenStream.expect('PUNCTUATION', '(')
        const args: Expression[] = []

        while (!this.tokenStream.isNext('PUNCTUATION', ')', ',')) {
            if (this.tokenStream.peek()?.kind === 'INTEGER_LITERAL') {
                args.push(IntegerLiteralParser.create(this.tokenStream).parse())
            } else if (this.tokenStream.peek()?.kind === 'TRUTHVALUE_LITERAL') {
                args.push(
                    TruthvalueLiteralParser.create(this.tokenStream).parse(),
                )
            } else {
                throw new Error(
                    `Unsupported argument type: ${this.tokenStream.peek()?.kind}`,
                )
            }

            if (this.tokenStream.isNext('PUNCTUATION', ')')) {
                this.tokenStream.next() // Consume the closing parenthesis
                break
            }

            this.tokenStream.expect('PUNCTUATION', ',')
        }
        return {
            type: 'CALL_FUNC',
            signature: {
                baseName: nameToken.identifier,
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
