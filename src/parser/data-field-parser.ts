import { Context } from '.'
import { TokenStream } from '../lexer'
import { Expression } from '../model'
import { DataField } from '../model/data-declaration'
import { ExpressionParser } from './expression-parser'
import {
    SemanticsKeyword,
    SemanticsKeywordParser,
} from './semantics-keyword-parser'
import { ValueSetParser } from './value-set-parser'

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
        const valueSet = ValueSetParser.create(this.context).parse(
            stream,
            keyword.isolationLevel,
        )

        let defaultValue: Expression | undefined
        if (stream.isNext('PUNCTUATION', '=')) {
            stream.expect('PUNCTUATION', '=')
            defaultValue = ExpressionParser.create(this.context).parse(stream)
        }

        return {
            ...keyword,
            name: fieldName,
            valueSet,
            defaultValue,
        }
    }
}
