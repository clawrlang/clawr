import { ASTBinaryExpression, ASTExpression } from '../ast'
import { TokenStream } from '../lexer'

export class ExpressionParser {
    constructor(private stream: TokenStream) {}

    parse(): ASTExpression {
        let expr = this.parsePrimaryExpression()
        while (this.stream.isNext('OPERATOR', ['.'])) {
            const dotToken = this.stream.expect('OPERATOR')
            const right = this.parsePrimaryExpression()
            const binary: ASTBinaryExpression = {
                kind: 'binary',
                operator: '.',
                left: expr,
                right,
                position: { line: dotToken.line, column: dotToken.column },
            }
            expr = binary
        }
        return expr
    }

    private parsePrimaryExpression(): ASTExpression {
        const token = this.stream.peek()
        switch (token?.kind) {
            case 'TRUTH_LITERAL':
                this.stream.next()
                return {
                    kind: 'truthvalue',
                    value: token.value,
                    position: { line: token.line, column: token.column },
                }
            case 'IDENTIFIER':
                this.stream.next()
                return {
                    kind: 'identifier',
                    name: token.identifier,
                    position: { line: token.line, column: token.column },
                }
            case 'PUNCTUATION':
                if (token.symbol === '{') {
                    this.stream.next()
                    const fields: { [field: string]: ASTExpression } = {}
                    while (!this.stream.isNext('PUNCTUATION', '}')) {
                        const fieldName =
                            this.stream.expect('IDENTIFIER').identifier
                        this.stream.expect('PUNCTUATION', ':')
                        const fieldValue = this.parse()
                        fields[fieldName] = fieldValue
                        if (this.stream.isNext('PUNCTUATION', ','))
                            this.stream.next()

                        if (this.stream.isNext('NEWLINE')) {
                            this.stream.next({ stopAtNewline: true })
                        }
                    }
                    this.stream.expect('PUNCTUATION', '}')
                    return {
                        kind: 'data-literal',
                        fields,
                        position: { line: token.line, column: token.column },
                    }
                } else {
                    throw new Error(
                        `${token.line}:${token.column}:Unexpected punctuation [${token.symbol}] in expression`,
                    )
                }
            default:
                throw new Error(
                    `${token?.line}:${token?.column}:Unexpected token [${token?.kind}] in expression`,
                )
        }
    }
}
