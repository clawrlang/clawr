import { Token, TokenStream } from '@/lexer'
import { IdentifierToken } from '@/lexer/token'
import { IntegerLiteral, RealLiteral } from '@/model/literals'
import {
    decorateTypeConstraint,
    TypeConstraintDeclaration,
} from '@/model/type-constraint-declaration'
import { TypeName } from '@/model/type-name'
import {
    IntegerSet,
    RCTypeSet,
    RealSet,
    StringSet,
    TruthvalueSet,
} from '@/model/value-set'
import { Context } from '@/parser'
import { ExpressionParser } from '@/parser/expression-parser'
import { SourceError } from '@/tools'
import { decimal } from 'decimalish'

export class TypeConstraintParser {
    private constructor(private context: Context) {}

    static create(context: Context): TypeConstraintParser {
        return new TypeConstraintParser(context)
    }

    parse(
        stream: TokenStream,
        {
            allowMissingRealPrecision = false,
        }: {
            allowMissingRealPrecision?: boolean
        } = {},
    ): TypeConstraintDeclaration {
        const typeToken = stream.expect('IDENTIFIER')
        const type = typeToken.identifier

        const alias = this.context.scope?.typeAlias(type)
        if (alias)
            return this.parseTypeAlias(
                stream,
                typeToken,
                alias,
                allowMissingRealPrecision,
            )

        switch (type) {
            case 'integer':
                return this.parseIntegerConstraint(stream, typeToken)
            case 'real':
                return this.parseRealConstraint(stream, typeToken, {
                    allowMissingPrecision: allowMissingRealPrecision,
                })
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

    private parseRealConstraint(
        stream: TokenStream,
        typeToken: IdentifierToken,
        {
            allowMissingPrecision = false,
        }: {
            allowMissingPrecision?: boolean
        } = {},
    ): TypeConstraintDeclaration {
        let min: decimal | undefined = undefined
        let max: decimal | undefined = undefined
        let end = typeToken.end
        const expressionParser = ExpressionParser.create(this.context)

        if (stream.isNext('PUNCTUATION', '(')) {
            stream.expect('PUNCTUATION', '(')
            if (!stream.isNext('OPERATOR', '...')) {
                const lower = expressionParser.parse(stream)
                if (!(lower instanceof RealLiteral))
                    throw SourceError.create({
                        message: 'Expected a real literal',
                        span: lower.span,
                    })
                min = lower.value.min
            }
            stream.expect('OPERATOR', '...')
            if (!stream.isNext('PUNCTUATION', ')')) {
                const upper = expressionParser.parse(stream)
                if (!(upper instanceof RealLiteral))
                    throw SourceError.create({
                        message: 'Expected a real literal',
                        span: upper.span,
                    })
                max = upper.value.max
            }
            end = stream.expect('PUNCTUATION', ')').end
        }

        const next = stream.peek()
        if (
            next?.kind !== 'IDENTIFIER' ||
            (next.identifier !== 'scale' && next.identifier !== 'sig')
        ) {
            if (allowMissingPrecision)
                return decorateTypeConstraint(RealSet.range({ min, max }), {
                    span: { start: typeToken.start, end },
                })
            throw SourceError.create({
                message: 'A real type requires an explicit precision',
                span: { start: typeToken.start, end },
            })
        }
        const { precision, end: precisionEnd } = this.parsePrecision(stream)
        return decorateTypeConstraint(RealSet.range({ min, max, precision }), {
            span: { start: typeToken.start, end: precisionEnd },
        })
    }

    private parseTypeAlias(
        stream: TokenStream,
        typeToken: IdentifierToken,
        alias: TypeConstraintDeclaration,
        allowMissingRealPrecision: boolean,
    ): TypeConstraintDeclaration {
        let value: TypeConstraintDeclaration = alias
        let end = typeToken.end
        const next = stream.peek()
        if (alias instanceof RealSet) {
            const hasPrecision =
                next?.kind === 'IDENTIFIER' &&
                (next.identifier === 'scale' || next.identifier === 'sig')
            if (hasPrecision && alias.precision)
                throw SourceError.create({
                    message: `Type alias ${typeToken.identifier} already defines real precision`,
                    span: { start: next.start, end: next.end },
                })
            if (hasPrecision) {
                const parsed = this.parsePrecision(stream)
                value = decorateTypeConstraint(
                    RealSet.range({
                        min: alias.min,
                        max: alias.max,
                        precision: parsed.precision,
                    }),
                    { span: alias.span },
                )
                end = parsed.end
            } else if (!alias.precision && !allowMissingRealPrecision) {
                throw SourceError.create({
                    message: 'A real type requires an explicit precision',
                    span: { start: typeToken.start, end: typeToken.end },
                })
            }
        } else if (
            next?.kind === 'IDENTIFIER' &&
            (next.identifier === 'scale' || next.identifier === 'sig')
        ) {
            const precisionToken = next
            throw SourceError.create({
                message: `Type alias ${typeToken.identifier} is not real and cannot have real precision`,
                span: {
                    start: precisionToken.start,
                    end: precisionToken.end,
                },
            })
        }
        return decorateTypeConstraint(value, {
            span: { start: typeToken.start, end },
        })
    }

    private parsePrecision(stream: TokenStream) {
        const kindToken = stream.expect('IDENTIFIER')
        if (kindToken.identifier !== 'scale' && kindToken.identifier !== 'sig')
            throw SourceError.create({
                message: 'Expected `scale` or `sig` precision',
                span: { start: kindToken.start, end: kindToken.end },
            })
        const digitsToken = stream.expect('INTEGER_LITERAL')
        if (
            digitsToken.value < 0n ||
            digitsToken.value > BigInt(Number.MAX_SAFE_INTEGER)
        )
            throw SourceError.create({
                message: 'Real precision must be a non-negative safe integer',
                span: { start: digitsToken.start, end: digitsToken.end },
            })
        let base: 'dec' | 'bin' | 'ter' = 'dec'
        let end = digitsToken.end
        if (stream.peek()?.kind === 'IDENTIFIER') {
            const candidate = stream.peek() as IdentifierToken
            if (
                candidate.identifier === 'dec' ||
                candidate.identifier === 'bin' ||
                candidate.identifier === 'ter'
            ) {
                stream.expect('IDENTIFIER')
                base = candidate.identifier
                end = candidate.end
            }
        }
        return {
            precision: {
                kind: kindToken.identifier as 'scale' | 'sig',
                digits: Number(digitsToken.value),
                base,
            },
            end,
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
            if (!stream.isNext('PUNCTUATION', ')')) {
                if (stream.isNext('PUNCTUATION', ','))
                    stream.expect('PUNCTUATION', ',')
                else stream.expect('OPERATOR', '|')
            }
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
