import { ASTStatement } from '../../ast'
import { TokenStream } from '../../lexer'

export class DataDeclarationParser {
    constructor(private stream: TokenStream) {}

    isNext(): boolean {
        const token = this.stream.peek()
        return token?.kind === 'KEYWORD' && token.keyword === 'data'
    }

    parse(): ASTStatement {
        const token = this.stream.expect('KEYWORD', 'data')
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
            } else if (this.stream.isNext('NEWLINE')) {
                this.stream.next({ stopAtNewline: true })
            }
        }
        this.stream.expect('PUNCTUATION', '}')
        return {
            kind: 'data-decl',
            name,
            fields,
            position: { line: token.line, column: token.column },
        }
    }
}
