import { ExpressionParser } from './expression-parser'
import { TokenStream } from '../lexer'
import {
    VARIABLE_SEMANTICS,
    VariableDeclaration,
} from '../model/variable-declaration'
import { StatementParser } from './statement-parser'
import { Context } from '.'
import { ValueSetParser } from './value-set-parser'
import { SemanticsKeyword } from './semantics-keyword-parser'
import {
    AnyIsolationLevel,
    ISOLATED,
    IsolationLevel,
    UNIQUE,
} from '../model/isolation-level'
import { ExplicitValueSet } from '../model/explicit-value-set'

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
        const semanticsKeyword = SemanticsKeyword[semanticsToken.keyword]
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        const valueSet = this.parseTypeIdentifier(
            stream,
            semanticsKeyword.isolationLevel,
        )
        stream.expect('PUNCTUATION', '=')
        const initialValue = this.expressionParser.parse(stream)
        return VariableDeclaration.create({
            ...semanticsKeyword,
            name,
            valueSet,
            initialValue,
        })
    }

    private parseTypeIdentifier<IsolationLevel extends AnyIsolationLevel>(
        stream: TokenStream,
        isolationLevel: IsolationLevel,
    ): ExplicitValueSet<IsolationLevel | ISOLATED> {
        if (!stream.isNext('PUNCTUATION', ':')) return { isolationLevel }

        stream.expect('PUNCTUATION', ':')
        return (
            ValueSetParser.create(this.context).parse(
                stream,
                isolationLevel,
            ) ?? { isolationLevel }
        )
    }
}
