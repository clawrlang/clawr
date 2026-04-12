import { ASTStatement } from '../../ast'
import { ExpressionParser } from '../expression-parser'
import { TokenStream } from '../../lexer'

export class ExpressionStatementParser {
    constructor(private stream: TokenStream) {}

    isNext(): boolean {
        return true
    }

    parse(): ASTStatement {
        const target = new ExpressionParser(this.stream).parse()
        if (this.stream.isNext('PUNCTUATION', '=')) {
            const firstToken = this.stream.next()!! // consume '='
            const value = new ExpressionParser(this.stream).parse()
            return {
                kind: 'assign',
                target,
                value,
                position: {
                    file: this.stream.file,
                    line: target.position.line,
                    column: target.position.column,
                },
            }
        }
        return { kind: 'expression', expr: target }
    }
}
