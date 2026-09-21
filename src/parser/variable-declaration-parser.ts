import { TokenStream } from '@/lexer'
import { DomainDeclaration } from '@/model/domain-declaration'
import {
    VARIABLE_SEMANTICS,
    VariableDeclaration,
} from '@/model/variable-declaration'
import { Context } from '.'
import { DomainParser } from './domain-parser'
import { ExpressionParser } from './expression-parser'
import { SemanticsKeyword } from './semantics-keyword-parser'
import { StatementParser } from './statement-parser'

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
        const domain = this.parseDomain(stream)
        stream.expect('PUNCTUATION', '=')
        const initialValue = this.expressionParser.parse(stream)
        return VariableDeclaration.create({
            ...semanticsKeyword,
            name,
            isolationLevel: semanticsKeyword.isolationLevel,
            domain,
            initialValue,
        })
    }

    private parseDomain(stream: TokenStream): DomainDeclaration | undefined {
        if (!stream.isNext('PUNCTUATION', ':')) return undefined

        stream.expect('PUNCTUATION', ':')
        return DomainParser.create(this.context).parse(stream)
    }
}
