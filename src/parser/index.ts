import { Expression } from '../cir'
import { TokenStream } from '../lexer'

export class TruthvalueLiteralParser {
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
