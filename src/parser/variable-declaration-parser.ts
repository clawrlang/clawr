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
        const semanticsToken = this.stream.expect('KEYWORD', 'const', 'mut')
        const semantics = semanticsToken.keyword as 'const' | 'mut'
        const nameToken = this.stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        this.stream.expect('PUNCTUATION', ':')
        const typeToken = this.stream.expect('IDENTIFIER')
        const type = typeToken.identifier
        this.stream.expect('PUNCTUATION', '=')
        const initialValue = this.expressionParser.parse()
        return new VariableDeclaration(semantics, name, type, initialValue)
    }
}
