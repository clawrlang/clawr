import { ExpressionParser } from './expression-parser'
import { TokenStream } from '@/lexer'
import {
    VARIABLE_SEMANTICS,
    VariableDeclaration,
} from '@/model/variable-declaration'
import { StatementParser } from './statement-parser'
import { Context } from '.'
import { LatticeParser } from './lattice-parser'
import { SemanticsKeyword } from './semantics-keyword-parser'
import { LatticeDeclaration } from '@/model/lattice-declaration'

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
        const lattice = this.parseLattice(stream)
        stream.expect('PUNCTUATION', '=')
        const initialValue = this.expressionParser.parse(stream)
        return VariableDeclaration.create({
            ...semanticsKeyword,
            name,
            isolationLevel: semanticsKeyword.isolationLevel,
            lattice,
            initialValue,
        })
    }

    private parseLattice(stream: TokenStream): LatticeDeclaration | undefined {
        if (!stream.isNext('PUNCTUATION', ':')) return undefined

        stream.expect('PUNCTUATION', ':')
        return LatticeParser.create(this.context).parse(stream)
    }
}
