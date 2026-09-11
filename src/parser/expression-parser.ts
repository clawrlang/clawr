import { Context } from '.'
import { TokenStream } from '@/lexer'
import { Expression } from '@/model'
import { FieldReference } from '@/model/field-reference'
import { IntegerLiteral } from '@/model/integer-literal'
import { FunctionCall } from '@/model/function-call'
import { TruthValueLiteral } from '@/model/truthvalue-literal'
import { VariableReference } from '@/model/variable-reference'
import { DataLiteralParser } from './data-literal-parser'
import { FunctionArgumentsParser } from './function-arguments-parser'

export class ExpressionParser {
    private readonly dataLiteralParser: DataLiteralParser
    private readonly argsParser: FunctionArgumentsParser

    private constructor(private context: Context) {
        this.dataLiteralParser = DataLiteralParser.create(this.context, {
            expressionParser: this,
        })
        this.argsParser = FunctionArgumentsParser.create(this.context, {
            expressionParser: this,
        })
    }

    static create(context: Context): ExpressionParser {
        return new ExpressionParser(context)
    }

    parse(stream: TokenStream): Expression {
        return this.parsePrefixExpression(stream)
    }

    parsePrefixExpression(stream: TokenStream): Expression {
        if (stream.isNext('OPERATOR', '-')) {
            stream.next() // Consume the '-'
            const expression = this.parsePostfixOperation(stream)
            if (expression instanceof IntegerLiteral) return expression.negated
            throw new Error(
                'Unary negation is so far only supported for integer literals',
            )
        }
        return this.parsePostfixOperation(stream)
    }

    parsePostfixOperation(stream: TokenStream): Expression {
        let expression = this.parsePrimaryExpression(stream)

        while (true) {
            if (stream.isNext('PUNCTUATION', '(')) {
                if (expression instanceof VariableReference) {
                    const { arguments: args, end } =
                        this.argsParser.parse(stream)
                    expression = FunctionCall.create({
                        baseName: expression.name,
                        arguments: args,
                        span: {
                            start: expression.span.start,
                            end,
                        },
                    })
                    continue
                }

                if (expression instanceof FieldReference) {
                    const { arguments: args, end } =
                        this.argsParser.parse(stream)
                    expression = FunctionCall.create({
                        baseName: expression.field,
                        recipient: expression.object,
                        arguments: args,
                        span: {
                            start: expression.span.start,
                            end,
                        },
                    })
                    continue
                }

                throw new Error('Function calls can only be made on names')
            }

            if (stream.isNext('OPERATOR', '.', '->')) {
                const operator = stream.expect('OPERATOR', '.', '->').operator
                const fieldToken = stream.expect('IDENTIFIER')
                expression = FieldReference.create({
                    object: expression,
                    operator,
                    field: fieldToken.identifier,
                    span: {
                        start: expression.span.start,
                        end: fieldToken.end,
                    },
                    fieldSpan: {
                        start: fieldToken.start,
                        end: fieldToken.end,
                    },
                })
                continue
            }

            return expression
        }
    }

    private parsePrimaryExpression(stream: TokenStream): Expression {
        const nextToken = stream.peek()
        switch (nextToken?.kind) {
            case 'TRUTHVALUE_LITERAL':
                return this.parseTruthValueLiteral(stream)
            case 'INTEGER_LITERAL':
                return this.parseIntegerLiteral(stream)
            case 'IDENTIFIER':
                return this.parseVariableReference(stream)
            case 'PUNCTUATION':
                return this.parseDataLiteral(stream)
        }
        const token = stream.expectToken()
        this.context.errorReporter.reportFatalError(
            `Unexpected ${token.kind}`,
            {
                start: token.start,
                end: token.end,
            },
        )
    }

    private parseVariableReference(stream: TokenStream) {
        const token = stream.expect('IDENTIFIER')
        return VariableReference.create({
            name: token.identifier,
            span: { start: token.start, end: token.end },
        })
    }

    private parseTruthValueLiteral(stream: TokenStream) {
        const nextToken = stream.expect('TRUTHVALUE_LITERAL')
        return TruthValueLiteral.create({
            value: nextToken.value,
            span: { start: nextToken.start, end: nextToken.end },
        })
    }

    private parseIntegerLiteral(stream: TokenStream) {
        const nextToken = stream.expect('INTEGER_LITERAL')
        return IntegerLiteral.create({
            value: nextToken.value,
            span: { start: nextToken.start, end: nextToken.end },
        })
    }

    private parseDataLiteral(stream: TokenStream): Expression {
        return this.dataLiteralParser.parse(stream)
    }
}
