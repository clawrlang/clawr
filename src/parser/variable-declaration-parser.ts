import { ExpressionParser } from './expression-parser'
import { TokenStream } from '../lexer'
import {
    VariableSemantics,
    VARIABLE_SEMANTICS,
    VariableDeclaration,
} from '../model/variable-declaration'
import { StatementParser } from './statement-parser'
import { Context } from '.'
import { ValueSetParser } from './value-set-parser'

export class VariableDeclarationParser implements StatementParser<VariableDeclaration> {
    private expressionParser: ExpressionParser

    private constructor(private context: Context) {
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
        const semanticsKeyword = semanticsToken.keyword
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        const valueSet = this.parseTypeIdentifier(stream, semanticsKeyword)
        stream.expect('PUNCTUATION', '=')
        const initialValue = this.expressionParser.parse(stream)
        return VariableDeclaration.create({
            isImmutable:
                semanticsKeyword === 'const' || semanticsKeyword === 'ref',
            isolationLevel:
                semanticsKeyword === 'const' || semanticsKeyword === 'mut'
                    ? 'ISOLATED'
                    : 'SHARED',
            name,
            valueSet,
            initialValue,
        })
    }

    private parseTypeIdentifier(
        stream: TokenStream,
        semantics: VariableSemantics,
    ) {
        if (!stream.isNext('PUNCTUATION', ':')) return undefined

        stream.expect('PUNCTUATION', ':')
        return ValueSetParser.create(this.context).parse(stream, semantics)
    }
}
