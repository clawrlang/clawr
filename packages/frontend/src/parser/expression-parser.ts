import { TokenStream } from '@/lexer'
import { Expression } from '@/model'
import { FieldReference } from '@/model/field-reference'
import { FunctionCall } from '@/model/function-call'
import { IntegerLiteral, TruthValueLiteral } from '@/model/literals'
import {
    Addition,
    Comparison,
    Division,
    Exponential,
    Modulus,
    Multiplication,
    Subtraction,
} from '@/model/operators'
import { LogicalAND } from '@/model/operators/logical-and'
import { LogicalOR } from '@/model/operators/logical-or'
import { VariableReference } from '@/model/variable-reference'
import { Context } from '@/parser'
import { FunctionArgumentsParser } from '@/parser/function-arguments-parser'
import { DataLiteralParser } from '@/parser/literals'
import { SourceError } from '@/tools'

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
        return this.parseLogicalOR(stream)
    }

    parseLogicalOR(stream: TokenStream): Expression {
        let expr = this.parseLogicalAND(stream)
        while (stream.isNext('OPERATOR', '||')) {
            stream.expect('OPERATOR', '||')
            const right = this.parseLogicalAND(stream)
            expr = LogicalOR.create({
                left: expr,
                right,
                span: { start: expr.span.start, end: right.span.end },
            })
        }
        return expr
    }

    parseLogicalAND(stream: TokenStream): Expression {
        let expr = this.parseComparisonOperation(stream)
        while (stream.isNext('OPERATOR', '&&')) {
            stream.expect('OPERATOR', '&&')
            const right = this.parseComparisonOperation(stream)
            expr = LogicalAND.create({
                left: expr,
                right,
                span: { start: expr.span.start, end: right.span.end },
            })
        }
        return expr
    }

    parseComparisonOperation(stream: TokenStream): Expression {
        const left = this.parseAdditiveOperation(stream)
        if (!stream.isNext('OPERATOR', ...Comparison.operators)) return left
        const operatorToken = stream.expect('OPERATOR', ...Comparison.operators)
        const right = this.parseAdditiveOperation(stream)
        return Comparison.create({
            operator: operatorToken.operator,
            left,
            right,
            span: { start: left.span.start, end: right.span.end },
        })
    }

    parseAdditiveOperation(stream: TokenStream): Expression {
        let expr = this.parseMultiplicativeOperation(stream)
        while (stream.isNext('OPERATOR', '+', '-')) {
            const operator = stream.expect('OPERATOR', '+', '-').operator
            const right = this.parseMultiplicativeOperation(stream)
            expr =
                operator == '+'
                    ? Addition.create({
                          left: expr,
                          right,
                          span: { start: expr.span.start, end: right.span.end },
                      })
                    : Subtraction.create({
                          minuend: expr,
                          subtrahend: right,
                          span: { start: expr.span.start, end: right.span.end },
                      })
        }
        return expr
    }

    parseMultiplicativeOperation(stream: TokenStream): Expression {
        let expr = this.parseExponentialExpression(stream)
        while (stream.isNext('OPERATOR', '*', '/', '%')) {
            const operator = stream.expect('OPERATOR', '*', '/', '%').operator
            const right = this.parseExponentialExpression(stream)
            const config = {
                left: expr,
                dividend: expr,
                right,
                divisor: right,
                span: { start: expr.span.start, end: right.span.end },
            }
            expr =
                operator == '*'
                    ? Multiplication.create(config)
                    : operator == '%'
                      ? Modulus.create(config)
                      : Division.create(config)
        }
        return expr
    }

    parseExponentialExpression(stream: TokenStream): Expression {
        const base = this.parsePrefixExpression(stream)

        if (!stream.isNext('OPERATOR', '^')) return base
        stream.expect('OPERATOR', '^')

        const exponent = this.parseExponentialExpression(stream)
        return Exponential.create({
            base,
            exponent,
            span: {
                start: base.span.start,
                end: exponent.span.end,
            },
        })
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
        throw SourceError.create({
            message: `Unexpected ${token.kind}`,
            span: {
                start: token.start,
                end: token.end,
            },
        })
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
