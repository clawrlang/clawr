import { TokenStream } from '../lexer'
import * as model from '../model'
import { DataLiteralParser } from './data-literal-parser'

export class ExpressionParser {
    private constructor(private tokenStream: TokenStream) {}

    static create(tokenStream: TokenStream): ExpressionParser {
        return new ExpressionParser(tokenStream)
    }

    parse(): model.Expression {
        const nextToken = this.tokenStream.peek()
        if (!nextToken) {
            throw new Error('Unexpected end of input while parsing expression')
        }
        switch (nextToken.kind) {
            case 'TRUTHVALUE_LITERAL':
                this.tokenStream.next() // Consume the token
                return model.TruthValueLiteral.create(nextToken.value)
            case 'INTEGER_LITERAL':
                this.tokenStream.next() // Consume the token
                return model.IntegerLiteral.create(nextToken.value)
            case 'IDENTIFIER':
                this.tokenStream.next() // Consume the token
                if (this.tokenStream.isNext('OPERATOR', '.')) {
                    this.tokenStream.next() // Consume the '.'
                    const fieldToken = this.tokenStream.next()
                    if (fieldToken?.kind !== 'IDENTIFIER') {
                        throw new Error('Expected field name after "."')
                    }
                    return model.FieldLookupExpression.create({
                        object: model.VariableReference.create(
                            nextToken.identifier,
                        ),
                        field: fieldToken.identifier,
                    })
                }
                return model.VariableReference.create(nextToken.identifier)
            case 'PUNCTUATION':
                if (nextToken.symbol === '{') {
                    return DataLiteralParser.create({
                        tokenStream: this.tokenStream,
                    }).parse()
                } else {
                    throw new Error(
                        `Unexpected punctuation symbol: ${nextToken.symbol} while parsing expression`,
                    )
                }
            case 'OPERATOR':
                if (nextToken.operator === '-') {
                    this.tokenStream.next() // Consume the token
                    const nextToken = this.tokenStream.next()
                    if (nextToken?.kind !== 'INTEGER_LITERAL') {
                        throw new Error(
                            'Expected integer literal after "-" operator',
                        )
                    }
                    return model.IntegerLiteral.create(-nextToken.value)
                } else {
                    throw new Error(
                        `Unexpected operator "${nextToken.operator}" while parsing expression`,
                    )
                }
            default:
                throw new Error(
                    `Unexpected token kind: ${nextToken.kind} while parsing expression`,
                )
        }
    }
}
