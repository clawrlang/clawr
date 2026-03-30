import {
    ASTModule,
    ASTStatement,
    ASTExpression,
    ASTVariableDeclaration,
} from '../ast'
import { Token, TokenStream } from '../lexer'

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
        while (!is(this.stream.peek(), 'PUNCTUATION', '}')) {
            console.log(this.stream.peek())
            const fieldName = this.stream.expect('IDENTIFIER').identifier
            this.stream.expect('PUNCTUATION', ':')
            const fieldType = this.stream.expect('IDENTIFIER').identifier
            fields.push({ name: fieldName, type: fieldType })
            if (is(this.stream.peek(), 'PUNCTUATION', ',')) {
                this.stream.next()
            } else if (
                !is(this.stream.peek({ stopAtNewline: true }), 'NEWLINE')
            ) {
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
        const token = this.stream.peek()
        if (token?.kind == 'TRUTH_LITERAL') {
            this.stream.next()
            return {
                kind: 'truthvalue',
                value: token.value,
            }
        } else if (token?.kind === 'IDENTIFIER') {
            this.stream.next()
            return {
                kind: 'identifier',
                name: token.identifier,
            }
        }
        throw new Error(
            `${token?.line}:${token?.column}:Unexpected token [${token?.kind}] in expression`,
        )
    }
}

function is(token: Token | undefined, kind: 'NEWLINE'): boolean
function is(
    token: Token | undefined,
    kind: 'PUNCTUATION',
    value?: string,
): boolean
function is(
    token: Token | undefined,
    kind: Token['kind'],
    value?: string,
): boolean {
    if (!token) return false
    if (token.kind !== kind) return false

    switch (token.kind) {
        case 'NEWLINE':
            return true
        case 'PUNCTUATION':
            return token.symbol === value
        default:
            return false
    }
}
