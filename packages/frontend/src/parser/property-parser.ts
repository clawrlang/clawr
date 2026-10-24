import { TokenStream } from '@/lexer'
import { Expression } from '@/model'
import { Property } from '@/model/data-declaration'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { ISOLATION_KEYWORDS, MUTABILITY_KEYWORDS } from '@/model/keywords'
import { Context } from '@/parser'
import { ExpressionParser } from '@/parser/expression-parser'
import { TypeConstraintParser } from '@/parser/type-constraint-parser'

export class PropertyParser {
    private constructor(private context: Context) {}

    static create(context: Context): PropertyParser {
        return new PropertyParser(context)
    }

    parse(stream: TokenStream): Property {
        const mutabilityToken = stream.isNext('KEYWORD', ...MUTABILITY_KEYWORDS)
            ? stream.expect('KEYWORD', ...MUTABILITY_KEYWORDS)
            : undefined
        const propertyNameToken = stream.expect('IDENTIFIER')
        const propertyName = propertyNameToken.identifier

        stream.expect('PUNCTUATION', ':')
        const isolationToken = stream.isNext('KEYWORD', ...ISOLATION_KEYWORDS)
            ? stream.expect('KEYWORD', ...ISOLATION_KEYWORDS)
            : undefined
        const type = TypeConstraintParser.create(this.context).parse(stream)

        let defaultValue: Expression | undefined
        if (stream.isNext('PUNCTUATION', '=')) {
            stream.expect('PUNCTUATION', '=')
            defaultValue = ExpressionParser.create(this.context).parse(stream)
        }

        return {
            name: propertyName,
            isImmutable: mutabilityToken?.keyword === 'const',
            isolationLevel:
                isolationToken?.keyword === 'ref' ? SHARED : ISOLATED,
            type,
            defaultValue,
        }
    }
}
