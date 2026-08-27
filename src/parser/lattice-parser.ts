import { Context } from '.'
import { Token, TokenStream } from '../lexer'
import { IdentifierToken } from '../lexer/token'
import { IntegerLiteral } from '../model/integer-literal'
import {
    decorateLattice,
    LatticeDeclaration,
} from '../model/lattice-declaration'
import { ExpressionParser } from './expression-parser'
import { TypeName } from '../model/type-name'
import {
    IntegerLattice,
    RCTypeLattice,
    StringLattice,
    TruthvalueLattice,
} from '../model/lattice'

export class LatticeParser {
    private constructor(private context: Context) {}

    static create(context: Context): LatticeParser {
        return new LatticeParser(context)
    }

    parse(stream: TokenStream): LatticeDeclaration {
        const typeToken = stream.expect('IDENTIFIER')
        const type = typeToken.identifier

        switch (type) {
            case 'integer':
                return this.parseIntegerLattice(stream, typeToken)
            case 'truthvalue':
                return this.parseTruthvalueLattice(stream, typeToken)
            case 'string':
                return decorateLattice(StringLattice.create(), {
                    span: { start: typeToken.start, end: typeToken.end },
                })
            default:
                return decorateLattice(
                    RCTypeLattice.create({
                        type: TypeName.create({ name: type }),
                    }),
                    {
                        span: { start: typeToken.start, end: typeToken.end },
                    },
                )
        }
    }

    private parseIntegerLattice(
        stream: TokenStream,
        typeToken: Token,
    ): LatticeDeclaration {
        if (!stream.isNext('PUNCTUATION', '('))
            return decorateLattice(IntegerLattice.unconstrained(), {
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

        return decorateLattice(IntegerLattice.create({ min, max }), {
            span: { start: typeToken.start, end: endToken.end },
        })
    }

    private parseTruthvalueLattice(
        stream: TokenStream,
        typeToken: IdentifierToken,
    ): LatticeDeclaration {
        if (!stream.isNext('PUNCTUATION', '('))
            return decorateLattice(TruthvalueLattice.unconstrained(), {
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

        return decorateLattice(
            values.length > 0
                ? TruthvalueLattice.create(values)
                : TruthvalueLattice.unconstrained(),
            { span: { start: typeToken.start, end: endToken.end } },
        )
    }
}
