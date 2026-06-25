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
                    if (fieldToken?.kind === 'IDENTIFIER')
                        return FieldReference.create({
                            object: VariableReference.create(
                                nextToken.identifier,
                            ),
                            field: fieldToken.identifier,
                        })
                    this.errorReporter.reportFatalError(
                        'Expected field name after "."',
                        {
                            start: fieldToken?.start || nextToken.start,
                            end: fieldToken?.end || nextToken.end,
                        },
                    )
                }
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
                    const literalToken = stream.next()
                    if (literalToken?.kind !== 'INTEGER_LITERAL')
                        this.errorReporter.reportFatalError(
                            'Expected integer literal after "-" operator',
                            {
                                start: literalToken?.start || nextToken.start,
                                end: literalToken?.end || nextToken.end,
                            },
                        )

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
