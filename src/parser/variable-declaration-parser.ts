import { ExpressionParser } from './expression.parser'
import { TokenStream } from '../lexer'
import { VariableDeclaration } from '../model/variable-declaration'
import { StatementParser } from './statement-parser'

export class VariableDeclarationParser implements StatementParser<VariableDeclaration> {
    private expressionParser: ExpressionParser

    private constructor() {
        this.expressionParser = ExpressionParser.create()
    }

    static create(): VariableDeclarationParser {
        return new VariableDeclarationParser()
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'const', 'mut')
    }

    parse(stream: TokenStream): VariableDeclaration {
        const semanticsToken = stream.expect('KEYWORD', 'const', 'mut')
        const semantics = semanticsToken.keyword as 'const' | 'mut'
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        stream.expect('PUNCTUATION', ':')
        const typeToken = stream.expect('IDENTIFIER')
        const type = typeToken.identifier
        stream.expect('PUNCTUATION', '=')
        const initialValue = this.expressionParser.parse(stream)
        return VariableDeclaration.create({
            semantics,
            name,
            type,
            initialValue,
        })
    }
}
