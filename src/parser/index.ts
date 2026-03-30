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
        } else if (
            token?.kind === 'KEYWORD' &&
            isValidVariableSemantics(token.keyword)
        ) {
            return this.parseVariableDeclaration()
        } else if (token?.kind === 'IDENTIFIER') {
            const backup = this.stream
            const ass = this.stream.attempt((clone) => {
                this.stream = clone
                try {
                    return this.parseAssignment()
                } catch {
                    return null
                }
            })
            if (ass) return ass
            this.stream = backup

            return this.parsePrintStatement()
        } else {
            return this.parsePrintStatement()
        }
    }
    private parseAssignment(): ASTStatement {
        // Parse the left-hand side (identifier or field-access)
        let target = this.parseExpression()
        // After parseExpression, expect '='
        if (!this.stream.isNext('PUNCTUATION', '=')) {
            throw new Error('Expected = in assignment')
        }
        this.stream.next() // consume '='
        const value = this.parseExpression()
        return {
            kind: 'assign',
            target,
            value,
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
        const semanticsToken = this.stream.peek()
        if (
            semanticsToken?.kind !== 'KEYWORD' ||
            !isValidVariableSemantics(semanticsToken.keyword)
        ) {
            throw new Error(
                'Expected variable declaration keyword (const, mut, ref)',
            )
        }
        const semantics = semanticsToken.keyword as 'const' | 'mut' | 'ref'
        this.stream.next() // consume the keyword
        const name = this.stream.expect('IDENTIFIER').identifier
        this.stream.expect('PUNCTUATION', ':')
        const type = this.stream.expect('IDENTIFIER').identifier
        this.stream.expect('PUNCTUATION', '=')
        const value = this.parseExpression()
        return {
            kind: 'var-decl',
            semantics,
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

function isValidVariableSemantics(keyword: string): boolean {
    return ['const', 'mut', 'ref'].includes(keyword)
}
