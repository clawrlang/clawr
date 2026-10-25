import { TokenStream } from '@/lexer'
import { Expression } from '@/model'
import { Property } from '@/model/data-declaration'
import { ISOLATED, IsolationLevel } from '@/model/isolation-level'
import { ISOLATION_KEYWORDS, IsolationKeyword } from '@/model/keywords'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { Context } from '@/parser'
import { BindingParser } from '@/parser/binding-parser'
import { ExpressionParser } from '@/parser/expression-parser'
import { TypeConstraintParser } from '@/parser/type-constraint-parser'
import { SourceCodeSpan, SourceError } from '@/tools'

export class PropertyParser {
    private bindingParser: BindingParser

    private constructor(private context: Context) {
        this.bindingParser = BindingParser.create(context)
    }

    static create(context: Context): PropertyParser {
        return new PropertyParser(context)
    }

    parse(stream: TokenStream): Property {
        const binding = this.bindingParser.parse(stream)
        if (binding.label)
            throw SourceError.create({
                message: 'Properties cannot have labels',
                span: binding.span,
            })
        if (!binding.type)
            throw SourceError.create({
                message: 'Properties must have explicit type',
                span: binding.span,
            })

        let defaultValue: Expression | undefined
        if (stream.isNext('PUNCTUATION', '=')) {
            stream.expect('PUNCTUATION', '=')
            defaultValue = ExpressionParser.create(this.context).parse(stream)
        }

        return {
            name: binding.name,
            isImmutable: binding.isImmutable ?? false,
            isolationLevel: binding.isolationLevel ?? ISOLATED,
            type: binding.type,
            defaultValue,
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

type Binding = {
    name: string
    isImmutable?: boolean
    type?: TypeConstraintDeclaration
    isolationLevel?: IsolationLevel
    span: SourceCodeSpan
    nameSpan: SourceCodeSpan
}
