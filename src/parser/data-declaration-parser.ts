import { Context } from '.'
import { TokenStream } from '../lexer'
import { TypeDeclaration } from '../model/type-declaration'
import { ExplicitValueSet } from '../model/explicit-value-set'
import {
    VARIABLE_SEMANTICS,
    VariableSemantics,
} from '../model/variable-declaration'
import { ValueSetParser } from './value-set-parser'

export class DataDeclarationParser {
    private constructor(private context: Context) {}

    static create(context: Context): DataDeclarationParser {
        return new DataDeclarationParser(context)
    }

    parse(stream: TokenStream): TypeDeclaration {
        stream.expect('KEYWORD', 'data')
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        stream.expect('PUNCTUATION', '{')
        const fields: {
            name: string
            valueSet: ExplicitValueSet
            semantics: VariableSemantics
        }[] = []
        while (!stream.isNext('PUNCTUATION', '}')) {
            let semantics = this.parseFieldSemantics(stream)
            const fieldNameToken = stream.expect('IDENTIFIER')
            const fieldName = fieldNameToken.identifier
            stream.expect('PUNCTUATION', ':')
            const valueSet = ValueSetParser.create(this.context).parse(stream)
            fields.push({
                name: fieldName,
                valueSet,
                semantics,
            })
        }
        stream.expect('PUNCTUATION', '}')
        return TypeDeclaration.create({ name, fields })
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
