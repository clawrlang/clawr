import { ExpressionParser } from '.'
import { TokenStream } from '../lexer'
import { VariableDeclaration } from '../model'

export class VariableDeclarationParser {
    private expressionParser: ExpressionParser

    private constructor(private stream: TokenStream) {
        this.expressionParser = ExpressionParser.create(stream)
    }

    static create({
        tokenStream,
    }: {
        tokenStream: TokenStream
    }): VariableDeclarationParser {
        return new VariableDeclarationParser(tokenStream)
    }

    parse(): VariableDeclaration {
        this.stream.expect('KEYWORD', 'const')
        const nameToken = this.stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        this.stream.expect('PUNCTUATION', ':')
        const typeToken = this.stream.expect('IDENTIFIER')
        const type = typeToken.identifier
        this.stream.expect('PUNCTUATION', '=')
        const initialValue = this.expressionParser.parse()
        this.stream.expect('PUNCTUATION', ';')
        return new VariableDeclaration(name, type, initialValue)
    }
}
