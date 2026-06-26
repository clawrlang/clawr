import { ErrorReporter } from '../diagnostics'
import { TokenStream } from '../lexer'
import { Expression } from '../model'
import { FieldReference } from '../model/field-reference'
import { IntegerLiteral } from '../model/integer-literal'
import { TruthValueLiteral } from '../model/truthvalue-literal'
import { VariableReference } from '../model/variable-reference'
import { DataLiteralParser } from './data-literal-parser'

export class ExpressionParser {
    private constructor(private errorReporter: ErrorReporter) {}

    static create({
        errorReporter,
    }: {
        errorReporter: ErrorReporter
    }): ExpressionParser {
        return new ExpressionParser(errorReporter)
    }

    parse(stream: TokenStream): Expression {
        if (stream.isNext('OPERATOR', '-')) {
            stream.next() // Consume the '-'
            const expression = this.parsePrimaryExpression(stream)
            if (!(expression instanceof IntegerLiteral))
                throw new Error(
                    'Unary negation can only be applied to integer literals',
                )
            return expression.negated
        }
        const expression = this.parsePrimaryExpression(stream)
        if (!stream.isNext('OPERATOR', '.')) return expression

        stream.next() // Consume the '.'
        const fieldToken = stream.next()
        if (fieldToken?.kind !== 'IDENTIFIER')
            throw new Error('Expected field name after "."')
        return FieldReference.create({
            object: expression,
            field: fieldToken.identifier,
        })
    }

    private parsePrimaryExpression(stream: TokenStream): Expression {
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
                return VariableReference.create(nextToken.identifier)
            case 'PUNCTUATION':
                if (nextToken.symbol === '{') {
                    return DataLiteralParser.create(this).parse(stream)
                } else {
                    this.errorReporter.reportFatalError(
                        `Unexpected punctuation symbol: ${nextToken.symbol} while parsing expression`,
                        {
                            start: nextToken.start,
                            end: nextToken.end,
                        },
                    )
                }
            case 'OPERATOR':
                if (nextToken.operator === '-') {
                    stream.next() // Consume the token
                    const literalToken = stream.peek()
                    if (literalToken?.kind !== 'INTEGER_LITERAL')
                        throw new Error('Expected integer literal after "-"')

                    stream.next() // Consume the token
                    return IntegerLiteral.create(-literalToken.value)
                } else {
                    this.errorReporter.reportFatalError(
                        `Unexpected operator "${nextToken.operator}" while parsing expression`,
                        {
                            start: nextToken.start,
                            end: nextToken.end,
                        },
                    )
                }
            default:
                this.errorReporter.reportFatalError(
                    `Unexpected token kind: ${nextToken.kind} while parsing expression`,
                    {
                        start: nextToken.start,
                        end: nextToken.end,
                    },
                )
        }
    }
}
