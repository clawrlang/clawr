import { Token, TokenStream } from '@/lexer'
import { ISOLATED, IsolationLevel, SHARED } from '@/model/isolation-level'
import {
    ISOLATION_KEYWORDS,
    IsolationKeyword,
    MUTABILITY_KEYWORDS,
} from '@/model/keywords'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { SourceCodeSpan } from '@/tools'
import { Context } from '.'
import { TypeConstraintParser } from './type-constraint-parser'

export class BindingParser {
    private context: Context

    private constructor(context: Context) {
        this.context = context
    }

    static create(context: Context): BindingParser {
        return new BindingParser(context)
    }

    parse(stream: TokenStream): Binding {
        const mutabilityToken = stream.isNext('KEYWORD', ...MUTABILITY_KEYWORDS)
            ? stream.expect('KEYWORD', ...MUTABILITY_KEYWORDS)
            : undefined
        let labelToken: (Token & { kind: 'IDENTIFIER' }) | undefined
        let nameToken = stream.expect('IDENTIFIER')
        if (stream.isNext('IDENTIFIER')) {
            labelToken = nameToken
            nameToken = stream.expect('IDENTIFIER')
        }
        const name = nameToken.identifier

        const typeConstraint = this.parseTypeConstraint(stream)
        const type = typeConstraint?.[0]
        let isolation = typeConstraint?.[1]

        return {
            name,
            label: labelToken?.identifier,
            isImmutable: !mutabilityToken
                ? undefined
                : mutabilityToken.keyword === 'const',
            type,
            isolationLevel:
                isolation === 'ref'
                    ? SHARED
                    : isolation === 'cow'
                      ? ISOLATED
                      : undefined,
            span: {
                start:
                    mutabilityToken?.start ??
                    labelToken?.start ??
                    nameToken.start,
                end: type?.span.end ?? nameToken.end,
            },
            nameSpan: { start: nameToken.start, end: nameToken.end },
        }
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

export type Binding = {
    name: string
    label?: string
    isImmutable?: boolean
    type?: TypeConstraintDeclaration
    isolationLevel?: IsolationLevel
    span: SourceCodeSpan
    nameSpan: SourceCodeSpan
}
