import { Token, TokenStream } from '@/lexer'
import { IdentifierToken } from '@/lexer/token'
import { decorateDomain, DomainDeclaration } from '@/model/domain-declaration'
import { IntegerLiteral } from '@/model/integer-literal'
import { TypeName } from '@/model/type-name'
import {
    IntegerRange,
    RCTypeSet,
    StringSet,
    TruthvalueSet,
} from '@/model/value-set'
import { Context } from '.'
import { ExpressionParser } from './expression-parser'

export class DomainParser {
    private constructor(private context: Context) {}

    static create(context: Context): DomainParser {
        return new DomainParser(context)
    }

    parse(stream: TokenStream): DomainDeclaration {
        const typeToken = stream.expect('IDENTIFIER')
        const type = typeToken.identifier

        switch (type) {
            case 'integer':
                return this.parseIntegerDomain(stream, typeToken)
            case 'truthvalue':
                return this.parseTruthvalueDomain(stream, typeToken)
            case 'string':
                return decorateDomain(StringSet.create(), {
                    span: { start: typeToken.start, end: typeToken.end },
                })
            default:
                return decorateDomain(
                    RCTypeSet.create({
                        type: TypeName.create({ name: type }),
                    }),
                    {
                        span: { start: typeToken.start, end: typeToken.end },
                    },
                )
        }
    }

    private parseIntegerDomain(
        stream: TokenStream,
        typeToken: Token,
    ): DomainDeclaration {
        if (!stream.isNext('PUNCTUATION', '('))
            return decorateDomain(IntegerRange.unconstrained(), {
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

            min = minExpression.value.min
        }

        const operatorToken = stream.expect('OPERATOR', '...', '..<')
        if (operatorToken.operator === '..<') {
            const maxExpression = expressionParser.parse(stream)
            if (!(maxExpression instanceof IntegerLiteral))
                this.context.errorReporter.reportFatalError(
                    'Expected an integer literal',
                    maxExpression.span,
                )

            max = maxExpression.value.max - 1n
        }

        if (!stream.isNext('PUNCTUATION', ')')) {
            const maxExpression = expressionParser.parse(stream)
            if (!(maxExpression instanceof IntegerLiteral))
                this.context.errorReporter.reportFatalError(
                    'Expected an integer literal',
                    maxExpression.span,
                )

            max = maxExpression.value.max
        }

        const endToken = stream.expect('PUNCTUATION', ')')

        return decorateDomain(IntegerRange.create({ min, max }), {
            span: { start: typeToken.start, end: endToken.end },
        })
    }

    private parseTruthvalueDomain(
        stream: TokenStream,
        typeToken: IdentifierToken,
    ): DomainDeclaration {
        if (!stream.isNext('PUNCTUATION', '('))
            return decorateDomain(TruthvalueSet.unconstrained(), {
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

        return decorateDomain(
            values.length > 0
                ? TruthvalueSet.create(values)
                : TruthvalueSet.unconstrained(),
            { span: { start: typeToken.start, end: endToken.end } },
        )
    }
}
