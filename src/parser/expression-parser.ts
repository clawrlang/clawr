import { ASTBinaryExpression, ASTCallArgument, ASTExpression } from '../ast'
import { TokenStream } from '../lexer'

export class ExpressionParser {
    constructor(private stream: TokenStream) {}

    parse(): ASTExpression {
        return this.parseAdditiveExpression()
    }

    // Lowest precedence currently supported.
    // Additional operator layers should be added above this method.
    private parseAdditiveExpression(): ASTExpression {
        let expr = this.parsePostfixExpression()

        while (true) {
            if (!this.stream.isNext('OPERATOR', ['+'])) {
                break
            }

            const op = this.stream.expect('OPERATOR', ['+'])
            const right = this.parsePostfixExpression()
            expr = {
                kind: 'binary',
                operator: '+',
                left: expr,
                right,
                position: { line: op.line, column: op.column },
            }
        }

        return expr
    }

    // Postfix operators have the highest precedence in the current grammar.
    private parsePostfixExpression(): ASTExpression {
        let expr = this.parsePrimaryExpression()

        while (true) {
            if (this.stream.isNext('PUNCTUATION', '(')) {
                const lparen = this.stream.expect('PUNCTUATION', '(')
                const args: ASTCallArgument[] = []

                while (!this.stream.isNext('PUNCTUATION', ')')) {
                    args.push(this.parseCallArgument())
                    if (this.stream.isNext('PUNCTUATION', ',')) {
                        this.stream.next()
                    } else {
                        break
                    }
                }

                this.stream.expect('PUNCTUATION', ')')
                expr = {
                    kind: 'call',
                    callee: expr,
                    arguments: args,
                    position: { line: lparen.line, column: lparen.column },
                }
                continue
            }

            if (this.stream.isNext('OPERATOR', ['.'])) {
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
                continue
            }

            break
        }
        return expr
    }

    private parseCallArgument(): ASTCallArgument {
        const labeled = this.stream.attempt((clone) => {
            if (!clone.isNext('IDENTIFIER')) return null
            const labelToken = clone.expect('IDENTIFIER')
            if (!clone.isNext('PUNCTUATION', ':')) return null
            clone.expect('PUNCTUATION', ':')
            const value = new ExpressionParser(clone).parse()
            return { label: labelToken.identifier, value }
        })

        if (labeled) return labeled
        return { value: this.parse() }
    }

    private parsePrimaryExpression(): ASTExpression {
        const token = this.stream.peek()
        switch (token?.kind) {
            case 'INTEGER_LITERAL':
                this.stream.next()
                return {
                    kind: 'integer',
                    value: token.value,
                    position: { line: token.line, column: token.column },
                }
            case 'TRUTH_LITERAL':
                this.stream.next()
                return {
                    kind: 'truthvalue',
                    value: token.value,
                    position: { line: token.line, column: token.column },
                }
            case 'IDENTIFIER':
                this.stream.next()
                if (token.identifier === 'copy') {
                    this.stream.expect('PUNCTUATION', '(')
                    const value = this.parse()
                    this.stream.expect('PUNCTUATION', ')')
                    return {
                        kind: 'copy',
                        value,
                        position: { line: token.line, column: token.column },
                    }
                }
                return {
                    kind: 'identifier',
                    name: token.identifier,
                    position: { line: token.line, column: token.column },
                }
            case 'PUNCTUATION':
                if (token.symbol === '(') {
                    this.stream.next()
                    const value = this.parse()
                    this.stream.expect('PUNCTUATION', ')')
                    return value
                }

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
