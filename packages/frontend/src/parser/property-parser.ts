import { TokenStream } from '@/lexer'
import { Expression } from '@/model'
import { Property } from '@/model/data-declaration'
import { Context } from '@/parser'
import { ExpressionParser } from '@/parser/expression-parser'
import {
    SemanticsKeyword,
    SemanticsKeywordParser,
} from '@/parser/semantics-keyword-parser'
import { TypeConstraintParser } from '@/parser/type-constraint-parser'

export class PropertyParser {
    private constructor(private context: Context) {}

    static create(context: Context): PropertyParser {
        return new PropertyParser(context)
    }

    parse(stream: TokenStream): Property {
        let keyword =
            SemanticsKeywordParser.parse(stream) ?? SemanticsKeyword.mut
        const propertyNameToken = stream.expect('IDENTIFIER')
        const propertyName = propertyNameToken.identifier

        stream.expect('PUNCTUATION', ':')
        const type = TypeConstraintParser.create(this.context).parse(stream)

        let defaultValue: Expression | undefined
        if (stream.isNext('PUNCTUATION', '=')) {
            stream.expect('PUNCTUATION', '=')
            defaultValue = ExpressionParser.create(this.context).parse(stream)
        }

        return {
            name: propertyName,
            isImmutable: keyword.isImmutable,
            isolationLevel: keyword.isolationLevel,
            type,
            defaultValue,
        }
    }
}
