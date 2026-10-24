import { TokenStream } from '@/lexer'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import {
    ISOLATION_KEYWORDS,
    IsolationKeyword,
    MUTABILITY_KEYWORDS,
} from '@/model/keywords'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { VariableDeclaration } from '@/model/variable-declaration'
import { Context } from '@/parser'
import { ExpressionParser } from '@/parser/expression-parser'
import { StatementParser } from '@/parser/statement-parser'
import { TypeConstraintParser } from '@/parser/type-constraint-parser'

export class VariableDeclarationParser implements StatementParser<VariableDeclaration> {
    private expressionParser: ExpressionParser

    private constructor(private context: Context) {
        this.expressionParser = ExpressionParser.create(context)
    }

    static create(context: Context): VariableDeclarationParser {
        return new VariableDeclarationParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', ...MUTABILITY_KEYWORDS)
    }

    parse(stream: TokenStream): VariableDeclaration {
        const mutabilityToken = stream.expect('KEYWORD', ...MUTABILITY_KEYWORDS)
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        const typeConstraint = this.parseTypeConstraint(stream)
        const type = typeConstraint?.[0]
        let isolation = typeConstraint?.[1]
        stream.expect('PUNCTUATION', '=')
        const initialValue = this.expressionParser.parse(stream)
        if (stream.isNext('KEYWORD', 'as')) {
            stream.next()
            isolation = stream.expect('KEYWORD', ...ISOLATION_KEYWORDS).keyword
        }
        return VariableDeclaration.create({
            isImmutable: mutabilityToken.keyword === 'const',
            name,
            isolationLevel:
                isolation === 'ref'
                    ? SHARED
                    : isolation === 'cow' || typeConstraint
                      ? ISOLATED
                      : undefined,
            type,
            initialValue,
            nameSpan: { start: nameToken.start, end: nameToken.end },
            span: { start: mutabilityToken.start, end: initialValue.span.end },
        })
    }

    private parseTypeConstraint(
        stream: TokenStream,
    ): [TypeConstraintDeclaration, IsolationKeyword | undefined] | undefined {
        if (!stream.isNext('PUNCTUATION', ':')) return undefined
        stream.expect('PUNCTUATION', ':')

        const isolationToken = stream.isNext('KEYWORD', ...ISOLATION_KEYWORDS)
            ? stream.expect('KEYWORD', ...ISOLATION_KEYWORDS)
            : undefined

        return [
            TypeConstraintParser.create(this.context).parse(stream),
            isolationToken?.keyword,
        ]
    }
}
