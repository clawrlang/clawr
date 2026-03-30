import { ASTStatement } from '../../ast'
import { TokenStream } from '../../lexer'
import { ExpressionParser } from '../expression-parser'

export class PrintStatementParser {
    constructor(private stream: TokenStream) {}

    isNext(): boolean {
        const token = this.stream.peek()
        return token?.kind === 'IDENTIFIER' && token.identifier === 'print'
    }

    parse(): ASTStatement {
        this.stream.expect('IDENTIFIER')
        return {
            kind: 'print',
            value: new ExpressionParser(this.stream).parse(),
        }
    }
}
