import { ExpressionParser } from './expression.parser'
import { TokenStream } from '../lexer'
import {
    Semantics,
    VARIABLE_SEMANTICS,
    VariableDeclaration,
} from '../model/variable-declaration'
import { StatementParser } from './statement-parser'
import { ErrorReporter } from '../diagnostics'

export class VariableDeclarationParser implements StatementParser<VariableDeclaration> {
    private expressionParser: ExpressionParser

    private constructor(private errorReporter: ErrorReporter) {
        this.expressionParser = ExpressionParser.create({ errorReporter })
    }

    static create({
        errorReporter,
    }: {
        errorReporter: ErrorReporter
    }): VariableDeclarationParser {
        return new VariableDeclarationParser(errorReporter)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', ...VARIABLE_SEMANTICS)
    }

    parse(stream: TokenStream): VariableDeclaration {
        const semanticsToken = stream.expect('KEYWORD', ...VARIABLE_SEMANTICS)
        const semantics = semanticsToken.keyword as Semantics
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
