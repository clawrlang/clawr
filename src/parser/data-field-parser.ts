import { Context } from '.'
import { TokenStream } from '../lexer'
import { DataField } from '../model/data-declaration'
import {
    VARIABLE_SEMANTICS,
    VariableSemantics,
} from '../model/variable-declaration'
import { ValueSetParser } from './value-set-parser'

export class DataFieldParser {
    private constructor(private context: Context) {}

    static create(context: Context): DataFieldParser {
        return new DataFieldParser(context)
    }

    parse(stream: TokenStream): DataField {
        let semantics = this.parseFieldSemantics(stream)
        const fieldNameToken = stream.expect('IDENTIFIER')
        const fieldName = fieldNameToken.identifier
        stream.expect('PUNCTUATION', ':')
        const valueSet = ValueSetParser.create(this.context).parse(stream)
        return {
            name: fieldName,
            valueSet,
            semantics,
        }
    }

    private parseFieldSemantics(stream: TokenStream) {
        if (stream.isNext('KEYWORD', ...VARIABLE_SEMANTICS)) {
            const semanticsToken = stream.expect(
                'KEYWORD',
                ...VARIABLE_SEMANTICS,
            )
            return semanticsToken.keyword as VariableSemantics
        }
        return 'mut'
    }
}
