import { Token, TokenStream } from '@/lexer'
import { IdentifierToken } from '@/lexer/token'
import { IntegerLiteral } from '@/model/literals'
import {
    decorateTypeConstraint,
    TypeConstraintDeclaration,
} from '@/model/type-constraint-declaration'
import { TypeName } from '@/model/type-name'
import {
    IntegerSet,
    RCTypeSet,
    StringSet,
    TruthvalueSet,
} from '@/model/value-set'
import { Context } from '@/parser'
import { ExpressionParser } from '@/parser/expression-parser'
import { SourceError } from '@/tools'

export class TypeConstraintParser {
    private constructor(private context: Context) {}

    static create(context: Context): TypeConstraintParser {
        return new TypeConstraintParser(context)
    }

    parse(stream: TokenStream): TypeConstraintDeclaration {
        const typeToken = stream.expect('IDENTIFIER')
        const type = typeToken.identifier

        switch (type) {
            case 'integer':
                return this.parseIntegerConstraint(stream, typeToken)
            case 'truthvalue':
                return this.parseTruthvalueConstraint(stream, typeToken)
            case 'string':
                return decorateTypeConstraint(StringSet.create(), {
                    span: { start: typeToken.start, end: typeToken.end },
                })
            default:
                return decorateTypeConstraint(
                    RCTypeSet.create({
                        type: TypeName.create({ name: type }),
                    }),
                    {
                        span: { start: typeToken.start, end: typeToken.end },
                    },
                )
        }
    }

    private parseIntegerConstraint(
        stream: TokenStream,
        typeToken: Token,
    ): TypeConstraintDeclaration {
        if (!stream.isNext('PUNCTUATION', '('))
            return decorateTypeConstraint(IntegerSet.unconstrained(), {
                span: { start: typeToken.start, end: typeToken.end },
            })

        let max: bigint | undefined
        let min: bigint | undefined

        stream.expect('PUNCTUATION', '(')

        const expressionParser = ExpressionParser.create(this.context)
        if (!stream.isNext('OPERATOR', '...', '..<')) {
            const minExpression = expressionParser.parse(stream)
            if (!(minExpression instanceof IntegerLiteral))
                throw SourceError.create({
                    message: 'Expected an integer literal',
                    span: minExpression.span,
                })

            min = minExpression.value.min
        }

        const operatorToken = stream.expect('OPERATOR', '...', '..<')
        if (operatorToken.operator === '..<') {
            const maxExpression = expressionParser.parse(stream)
            if (!(maxExpression instanceof IntegerLiteral))
                throw SourceError.create({
                    message: 'Expected an integer literal',
                    span: maxExpression.span,
                })

            max = maxExpression.value.max - 1n
        }

        if (!stream.isNext('PUNCTUATION', ')')) {
            const maxExpression = expressionParser.parse(stream)
            if (!(maxExpression instanceof IntegerLiteral))
                throw SourceError.create({
                    message: 'Expected an integer literal',
                    span: maxExpression.span,
                })

            max = maxExpression.value.max
        }

        const endToken = stream.expect('PUNCTUATION', ')')

        return decorateTypeConstraint(IntegerSet.range({ min, max }), {
            span: { start: typeToken.start, end: endToken.end },
        })
    }

    private parseTruthvalueConstraint(
        stream: TokenStream,
        typeToken: IdentifierToken,
    ): TypeConstraintDeclaration {
        if (!stream.isNext('PUNCTUATION', '('))
            return decorateTypeConstraint(TruthvalueSet.unconstrained(), {
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

        return decorateTypeConstraint(
            values.length > 0
                ? TruthvalueSet.create(values)
                : TruthvalueSet.unconstrained(),
            { span: { start: typeToken.start, end: endToken.end } },
        )
    }
}
