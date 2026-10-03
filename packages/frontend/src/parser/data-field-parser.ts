import { TokenStream } from '@/lexer'
import { Expression } from '@/model'
import { DataField } from '@/model/data-declaration'
import { Context } from '@/parser'
import { DomainParser } from '@/parser/domain-parser'
import { ExpressionParser } from '@/parser/expression-parser'
import {
    SemanticsKeyword,
    SemanticsKeywordParser,
} from '@/parser/semantics-keyword-parser'

export class DataFieldParser {
    private constructor(private context: Context) {}

    static create(context: Context): DataFieldParser {
        return new DataFieldParser(context)
    }

    parse(stream: TokenStream): DataField {
        let keyword =
            SemanticsKeywordParser.parse(stream) ?? SemanticsKeyword.mut
        const fieldNameToken = stream.expect('IDENTIFIER')
        const fieldName = fieldNameToken.identifier

        stream.expect('PUNCTUATION', ':')
        const domain = DomainParser.create(this.context).parse(stream)

        let defaultValue: Expression | undefined
        if (stream.isNext('PUNCTUATION', '=')) {
            stream.expect('PUNCTUATION', '=')
            defaultValue = ExpressionParser.create(this.context).parse(stream)
        }

        return {
            name: fieldName,
            isImmutable: keyword.isImmutable,
            isolationLevel: keyword.isolationLevel,
            domain,
            defaultValue,
        }
    }
}
