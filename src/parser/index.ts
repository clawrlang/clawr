import { Expression } from '../cir'
import { TokenStream } from '../lexer'

export class ExpressionParser {
    private constructor(private tokenStream: TokenStream) {}

    static create(tokenStream: TokenStream): ExpressionParser {
        return new ExpressionParser(tokenStream)
    }

    parse(): Expression {
        const nextToken = this.tokenStream.peek()
        if (!nextToken) {
            throw new Error('Unexpected end of input while parsing expression')
        }
        switch (nextToken.kind) {
            case 'TRUTHVALUE_LITERAL':
                return TruthvalueLiteralParser.create(this.tokenStream).parse()
            case 'INTEGER_LITERAL':
            default:
                return IntegerLiteralParser.create(this.tokenStream).parse()
        }
    }
}

class TruthvalueLiteralParser {
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

class IntegerLiteralParser {
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
