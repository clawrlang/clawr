import { Context } from '.'
import { Token, TokenStream } from '../lexer'
import { IdentifierToken } from '../lexer/token'
import { IntegerLiteral } from '../model/integer-literal'
import {
    ExplicitIntegerValueSet,
    ExplicitRCTypeValueSet,
    ExplicitStringValueSet,
    ExplicitTruthValueSet,
    ExplicitValueSet,
} from '../model/explicit-value-set'
import { ExpressionParser } from './expression-parser'
import { TypeName } from '../model/type-name'
import { IsolationLevel } from '../model'

export class ValueSetParser {
    private constructor(private context: Context) {}

    static create(context: Context): ValueSetParser {
        return new ValueSetParser(context)
    }

    parse(
        stream: TokenStream,
        isolationLevel: IsolationLevel,
    ): ExplicitValueSet {
        const typeToken = stream.expect('IDENTIFIER')
        const type = typeToken.identifier

        switch (type) {
            case 'integer':
                return this.parseIntegerValueSet(stream, typeToken)
            case 'truthvalue':
                return this.parseTruthvalueValueSet(stream, typeToken)
            case 'string':
                return ExplicitStringValueSet.create({
                    span: { start: typeToken.start, end: typeToken.end },
                })
            default:
                return ExplicitRCTypeValueSet.create({
                    type: TypeName.create({ name: type }),
                    isolationLevel,
                    span: { start: typeToken.start, end: typeToken.end },
                })
        }
    }

    parseIntegerValueSet(
        stream: TokenStream,
        typeToken: Token,
    ): ExplicitValueSet {
        if (!stream.isNext('PUNCTUATION', '('))
            return ExplicitIntegerValueSet.create({
                span: { start: typeToken.start, end: typeToken.end },
            })

        let max: bigint | undefined
        let min: bigint | undefined

        stream.expect('PUNCTUATION', '(')

        const expressionParser = ExpressionParser.create(this.context)
        if (!stream.isNext('OPERATOR', '...', '..<')) {
            const minExpression = expressionParser.parse(stream)
            if (!(minExpression instanceof IntegerLiteral))
                this.context.errorReporter.reportFatalError(
                    'Expected an integer literal',
                    minExpression.span,
                )

            min = minExpression.value
        }

        const operatorToken = stream.expect('OPERATOR', '...', '..<')
        if (operatorToken.operator === '..<') {
            const maxExpression = expressionParser.parse(stream)
            if (!(maxExpression instanceof IntegerLiteral))
                this.context.errorReporter.reportFatalError(
                    'Expected an integer literal',
                    maxExpression.span,
                )

            max = maxExpression.value - 1n
        }

        if (!stream.isNext('PUNCTUATION', ')')) {
            const maxExpression = expressionParser.parse(stream)
            if (!(maxExpression instanceof IntegerLiteral))
                this.context.errorReporter.reportFatalError(
                    'Expected an integer literal',
                    maxExpression.span,
                )

            max = maxExpression.value
        }

        const endToken = stream.expect('PUNCTUATION', ')')

        return ExplicitIntegerValueSet.create({
            min,
            max,
            span: { start: typeToken.start, end: endToken.end },
        })
    }

    parseTruthvalueValueSet(
        stream: TokenStream,
        typeToken: IdentifierToken,
    ): ExplicitValueSet {
        if (!stream.isNext('PUNCTUATION', '('))
            return ExplicitTruthValueSet.create({
                span: { start: typeToken.start, end: typeToken.end },
            })

        const values: ('false' | 'ambiguous' | 'true')[] = []

        stream.expect('PUNCTUATION', '(')
        while (!stream.isNext('PUNCTUATION', ')')) {
            const valueToken = stream.expect('TRUTHVALUE_LITERAL')
            values.push(valueToken.value)
            if (!stream.isNext('PUNCTUATION', ')'))
                stream.expect('PUNCTUATION', ',')
        }
        const endToken = stream.expect('PUNCTUATION', ')')

        return ExplicitTruthValueSet.create({
            values: values.length > 0 ? values : undefined,
            span: { start: typeToken.start, end: endToken.end },
        })
    }
}
