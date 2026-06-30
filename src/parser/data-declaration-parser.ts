import { Context } from '.'
import { TokenStream } from '../lexer'
import { DataDeclaration } from '../model/data-declaration'
import {
    VARIABLE_SEMANTICS,
    VariableSemantics,
} from '../model/variable-declaration'

export class DataDeclarationParser {
    private constructor(_: Context) {}

    static create(context: Context): DataDeclarationParser {
        return new DataDeclarationParser(context)
    }

    parse(stream: TokenStream): DataDeclaration {
        stream.expect('KEYWORD', 'data')
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier
        stream.expect('PUNCTUATION', '{')
        const fields: {
            name: string
            type: string
            semantics: VariableSemantics
        }[] = []
        while (!stream.isNext('PUNCTUATION', '}')) {
            let semantics = this.parseFieldSemantics(stream)
            const fieldNameToken = stream.expect('IDENTIFIER')
            const fieldName = fieldNameToken.identifier
            stream.expect('PUNCTUATION', ':')
            const fieldTypeToken = stream.expect('IDENTIFIER')
            const fieldType = fieldTypeToken.identifier
            fields.push({ name: fieldName, type: fieldType, semantics })
        }
        stream.expect('PUNCTUATION', '}')
        return DataDeclaration.create({ name, fields })
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
