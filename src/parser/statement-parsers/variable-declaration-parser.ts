import { ExpressionParser } from '../expression-parser'
import { ASTVariableDeclaration } from '../../ast'
import { TokenStream } from '../../lexer'

export class VariableDeclarationParser {
    constructor(private stream: TokenStream) {}

    isNext(): boolean {
        const token = this.stream.peek()
        return (
            token?.kind === 'KEYWORD' && isValidVariableSemantics(token.keyword)
        )
    }

    parse(): ASTVariableDeclaration {
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
        // parseExpression will be injected by the main parser
        // @ts-ignore
        const value = new ExpressionParser(this.stream).parse()
        return {
            kind: 'var-decl',
            semantics,
            name,
            valueSet: { type },
            value,
        }
    }
}

export function isValidVariableSemantics(keyword: string): boolean {
    return ['const', 'mut', 'ref'].includes(keyword)
}
