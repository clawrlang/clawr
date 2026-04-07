import { ASTStatement } from '../../ast'
import { ExpressionParser } from '../expression-parser'
import { TokenStream } from '../../lexer'

export class ExpressionStatementParser {
    constructor(private stream: TokenStream) {}

    isNext(): boolean {
        // Accept any expression that is not handled by other statement parsers
        // Only allow if next token could start an expression
        const next = this.stream.peek()
        if (!next) return false
        // Accept identifiers, literals, or open paren/bracket/brace
        return (
            next.kind === 'IDENTIFIER' ||
            next.kind === 'INTEGER_LITERAL' ||
            next.kind === 'TRUTH_LITERAL' ||
            next.kind === 'STRING_LITERAL' ||
            (next.kind === 'PUNCTUATION' &&
                ['(', '[', '{'].includes(next.symbol))
        )
    }

    parse(): ASTStatement {
        const value = new ExpressionParser(this.stream).parse()
        return { kind: 'expression', value }
    }
}
