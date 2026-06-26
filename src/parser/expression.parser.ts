import { ErrorReporter } from '../diagnostics'
import { TokenStream } from '../lexer'
import { TruthvalueLiteralToken } from '../lexer/token'
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
            if (expression instanceof IntegerLiteral) return expression.negated
            throw new Error(
                'Unary negation is so far only supported for integer literals',
            )
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
        this.errorReporter.reportFatalError(`Unexpected ${token.kind}`, {
            start: token.start,
            end: token.end,
        })
    }

    private parseVariableReference(stream: TokenStream) {
        const nextToken = stream.expect('IDENTIFIER')
        return VariableReference.create(nextToken.identifier)
    }

    private parseTruthValueLiteral(stream: TokenStream) {
        const nextToken = stream.expect('TRUTHVALUE_LITERAL')
        return TruthValueLiteral.create(nextToken.value)
    }

    private parseIntegerLiteral(stream: TokenStream) {
        const nextToken = stream.expect('INTEGER_LITERAL')
        return IntegerLiteral.create(nextToken.value)
    }

    private parseDataLiteral(stream: TokenStream): Expression {
        return DataLiteralParser.create(this).parse(stream)
    }
}
