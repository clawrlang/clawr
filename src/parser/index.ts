import {
    ASTModule,
    ASTStatement,
    ASTExpression,
    ASTVariableDeclaration,
    ASTFieldAccess,
} from '../ast'
import { TokenStream } from '../lexer'

export class Parser {
    constructor(private stream: TokenStream) {}

    parse(): ASTModule {
        const body: ASTStatement[] = []
        while (this.stream.peek()) {
            const stmt = this.parseStatement()
            body.push(stmt)
        }
        return { body }
    }

    private parseStatement(): ASTStatement {
        const token = this.stream.peek()
        if (token?.kind === 'KEYWORD' && token.keyword === 'data') {
            return this.parseDataDeclaration()
        } else if (token?.kind === 'KEYWORD' && token.keyword === 'const') {
            return this.parseVariableDeclaration()
        } else {
            return this.parsePrintStatement()
        }
    }

    private parseDataDeclaration(): ASTStatement {
        this.stream.expect('KEYWORD', 'data')
        const name = this.stream.expect('IDENTIFIER').identifier
        this.stream.expect('PUNCTUATION', '{')
        const fields: { name: string; type: string }[] = []
        while (!this.stream.isNext('PUNCTUATION', '}')) {
            const fieldName = this.stream.expect('IDENTIFIER').identifier
            this.stream.expect('PUNCTUATION', ':')
            const fieldType = this.stream.expect('IDENTIFIER').identifier
            fields.push({ name: fieldName, type: fieldType })
            if (this.stream.isNext('PUNCTUATION', ',')) {
                this.stream.next()
            } else if (!this.stream.isNext('NEWLINE')) {
                this.stream.next({ stopAtNewline: true })
            }
        }
        this.stream.expect('PUNCTUATION', '}')
        return {
            kind: 'data-decl',
            name,
            fields,
        }
    }

    private parseVariableDeclaration(): ASTVariableDeclaration {
        this.stream.expect('KEYWORD', 'const')
        const name = this.stream.expect('IDENTIFIER').identifier
        this.stream.expect('PUNCTUATION', ':')
        const type = this.stream.expect('IDENTIFIER').identifier
        this.stream.expect('PUNCTUATION', '=')
        const value = this.parseExpression()
        return {
            kind: 'var-decl',
            semantics: 'const',
            name,
            valueSet: { type },
            value,
        }
    }

    private parsePrintStatement(): ASTStatement {
        this.stream.expect('IDENTIFIER')
        return {
            kind: 'print',
            value: this.parseExpression(),
        }
    }

    private parseExpression(): ASTExpression {
        const expr = this.parsePrimaryExpression()
        if (!this.stream.isNext('OPERATOR', ['.'])) return expr

        let object: ASTExpression = expr
        while (this.stream.isNext('OPERATOR', ['.'])) {
            this.stream.next()
            const field = this.stream.expect('IDENTIFIER').identifier
            const fieldAccess: ASTFieldAccess = {
                kind: 'field-access',
                object,
                field,
            }
            object = fieldAccess
        }
        return object
    }

    private parsePrimaryExpression(): ASTExpression {
        const token = this.stream.peek()
        switch (token?.kind) {
            case 'TRUTH_LITERAL':
                this.stream.next()
                return {
                    kind: 'truthvalue',
                    value: token.value,
                }
            case 'IDENTIFIER':
                this.stream.next()
                return {
                    kind: 'identifier',
                    name: token.identifier,
                }
            case 'PUNCTUATION':
                if (token.symbol === '{') {
                    this.stream.next()
                    const fields: { [field: string]: ASTExpression } = {}
                    while (!this.stream.isNext('PUNCTUATION', '}')) {
                        const fieldName =
                            this.stream.expect('IDENTIFIER').identifier
                        this.stream.expect('PUNCTUATION', ':')
                        const fieldValue = this.parseExpression()
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
