import { ExpressionParser } from './expression.parser'
import { TokenStream } from '../lexer'
import {
    VaribleKind,
    VARIABLE_KINDS,
    VariableDeclaration,
} from '../model/variable-declaration'
import { StatementParser } from './statement-parser'
import { ErrorReporter } from '../diagnostics'

export class VariableDeclarationParser implements StatementParser<VariableDeclaration> {
    private expressionParser: ExpressionParser

    private constructor(errorReporter: ErrorReporter) {
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
        return stream.isNext('KEYWORD', ...VARIABLE_KINDS)
    }

    parse(stream: TokenStream): VariableDeclaration {
        const semanticsToken = stream.expect('KEYWORD', ...VARIABLE_KINDS)
        const semantics = semanticsToken.keyword as VaribleKind
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
