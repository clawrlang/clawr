import { Expression } from '../cir'
import { TokenStream } from '../lexer'

export interface ExpressionParser {
    parse(): Expression
}

export class TruthvalueLiteralParser implements ExpressionParser {
    private constructor(private tokenStream: TokenStream) {}

    static create(tokenStream: TokenStream): TruthvalueLiteralParser {
        return new TruthvalueLiteralParser(tokenStream)
    }

    parse(): Extract<Expression, { type: 'TRUTHVALUE_LITERAL' }> {
        const token = this.tokenStream.next()
        if (token?.kind !== 'TRUTHVALUE_LITERAL') {
            throw new Error('Expected truthvalue literal')
        }
        return { type: 'TRUTHVALUE_LITERAL', value: token.value }
    }
}

export class IntegerLiteralParser implements ExpressionParser {
    private constructor(private tokenStream: TokenStream) {}

    static create(tokenStream: TokenStream): IntegerLiteralParser {
        return new IntegerLiteralParser(tokenStream)
    }

    parse(): Extract<Expression, { type: 'INTEGER_LITERAL' }> {
        const token = this.tokenStream.next()
        if (token?.kind === 'OPERATOR' && token.operator === '-') {
            const nextToken = this.tokenStream.next()
            if (nextToken?.kind !== 'INTEGER_LITERAL') {
                throw new Error('Expected integer literal after "-" operator')
            }
            return {
                type: 'INTEGER_LITERAL',
                value: `-${nextToken.value.toString()}`,
            }
        } else if (token?.kind !== 'INTEGER_LITERAL') {
            throw new Error('Expected integer literal')
        }
        return { type: 'INTEGER_LITERAL', value: token.value.toString() }
    }
}
