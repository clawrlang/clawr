import {
    ASTModule,
    ASTStatement,
    ASTExpression,
    ASTVariableDeclaration,
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
        if (token?.kind === 'KEYWORD' && token.keyword === 'const') {
            return this.parseVariableDeclaration()
        } else {
            return this.parsePrintStatement()
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
            name,
            semantics: 'const',
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
