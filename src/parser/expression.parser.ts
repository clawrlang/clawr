import { TokenStream } from '../lexer'
import { Expression } from '../model'
import { FieldLookupExpression } from '../model/field-lookup-expression'
import { IntegerLiteral } from '../model/integer-literal'
import { TruthValueLiteral } from '../model/truthvalue-literal'
import { VariableReference } from '../model/variable-reference'
import { DataLiteralParser } from './data-literal-parser'

export class ExpressionParser {
    private constructor() {}

    static create(): ExpressionParser {
        return new ExpressionParser()
    }

    parse(stream: TokenStream): Expression {
        const nextToken = stream.peek()
        if (!nextToken) {
            throw new Error('Unexpected end of input while parsing expression')
        }
        switch (nextToken.kind) {
            case 'TRUTHVALUE_LITERAL':
                stream.next() // Consume the token
                return TruthValueLiteral.create(nextToken.value)
            case 'INTEGER_LITERAL':
                stream.next() // Consume the token
                return IntegerLiteral.create(nextToken.value)
            case 'IDENTIFIER':
                stream.next() // Consume the token
                if (stream.isNext('OPERATOR', '.')) {
                    stream.next() // Consume the '.'
                    const fieldToken = stream.next()
                    if (fieldToken?.kind !== 'IDENTIFIER') {
                        throw new Error('Expected field name after "."')
                    }
                    return FieldLookupExpression.create({
                        object: VariableReference.create(nextToken.identifier),
                        field: fieldToken.identifier,
                    })
                }
                return VariableReference.create(nextToken.identifier)
            case 'PUNCTUATION':
                if (nextToken.symbol === '{') {
                    return DataLiteralParser.create().parse(stream)
                } else {
                    throw new Error(
                        `Unexpected punctuation symbol: ${nextToken.symbol} while parsing expression`,
                    )
                }
            case 'OPERATOR':
                if (nextToken.operator === '-') {
                    stream.next() // Consume the token
                    const nextToken = stream.next()
                    if (nextToken?.kind !== 'INTEGER_LITERAL') {
                        throw new Error(
                            'Expected integer literal after "-" operator',
                        )
                    }
                    return IntegerLiteral.create(-nextToken.value)
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
