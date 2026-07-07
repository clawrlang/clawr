import { ExpressionParser } from './expression-parser'
import { TokenStream } from '../lexer'
import {
    VariableSemantics,
    VARIABLE_SEMANTICS,
    VariableDeclaration,
} from '../model/variable-declaration'
import { StatementParser } from './statement-parser'
import { Context } from '.'

export class VariableDeclarationParser implements StatementParser<VariableDeclaration> {
    private expressionParser: ExpressionParser

    private constructor(context: Context) {
        this.expressionParser = ExpressionParser.create(context)
    }

    static create(context: Context): VariableDeclarationParser {
        return new VariableDeclarationParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', ...VARIABLE_SEMANTICS)
    }

    parse(stream: TokenStream): VariableDeclaration {
        const semanticsToken = stream.expect('KEYWORD', ...VARIABLE_SEMANTICS)
        const semantics = semanticsToken.keyword as VariableSemantics
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        const type = this.parseTypeIdentifier(stream)
        stream.expect('PUNCTUATION', '=')
        const initialValue = this.expressionParser.parse(stream)
        return VariableDeclaration.create({
            semantics,
            name,
            type,
            initialValue,
        })
    }

    private parseTypeIdentifier(stream: TokenStream) {
        if (!stream.isNext('PUNCTUATION', ':')) return undefined

        stream.expect('PUNCTUATION', ':')
        const typeToken = stream.expect('IDENTIFIER')
        return typeToken.identifier
    }
}
