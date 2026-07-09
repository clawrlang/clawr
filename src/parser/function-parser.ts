import { Context } from '.'
import { TokenStream, Token } from '../lexer'
import { FunctionDeclaration, Parameter } from '../model/function-declaration'
import { ReturnStatement } from '../model/return-statement'
import { ValueSet } from '../model/value-set'
import { BlockParser } from './block-parser'
import { ExpressionParser } from './expression-parser'
import { ValueSetParser } from './value-set-parser'

export class FunctionParser {
    private readonly valueSetParser: ValueSetParser

    private constructor(private context: Context) {
        this.valueSetParser = ValueSetParser.create(context)
    }

    static create(context: Context): FunctionParser {
        return new FunctionParser(context)
    }

    parse(stream: TokenStream): FunctionDeclaration {
        stream.expect('KEYWORD', 'func')
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier

        const parameters = this.parseParameters(stream)

        let result: ValueSet | undefined = undefined
        if (stream.isNext('OPERATOR', '->')) {
            stream.expect('OPERATOR', '->')
            result = this.valueSetParser.parse(stream)
        }

        if (stream.isNext('PUNCTUATION', '=>')) {
            stream.expect('PUNCTUATION', '=>')
            const returnExpression = ExpressionParser.create(
                this.context,
            ).parse(stream)

            return FunctionDeclaration.create({
                name,
                parameters,
                result,
                body: [ReturnStatement.create(returnExpression)],
            })
        }

        const body = BlockParser.create(this.context).parse(stream)

        return FunctionDeclaration.create({
            name,
            parameters,
            result,
            body,
        })
    }

    private parseParameters(stream: TokenStream) {
        stream.expect('PUNCTUATION', '(')
        const parameters: Parameter[] = []
        while (!stream.isNext('PUNCTUATION', ')')) {
            const labelToken = stream.expect('IDENTIFIER')
            let varNameToken: (Token & { kind: 'IDENTIFIER' }) | undefined

            if (stream.isNext('IDENTIFIER'))
                varNameToken = stream.expect('IDENTIFIER')
            else varNameToken = labelToken

            stream.expect('PUNCTUATION', ':')

            parameters.push(
                Parameter.create({
                    label:
                        labelToken.identifier === '_'
                            ? undefined
                            : labelToken.identifier,
                    varName: varNameToken.identifier,
                    valueSet: this.valueSetParser.parse(stream),
                }),
            )

            if (!stream.isNext('PUNCTUATION', ')'))
                stream.expect('PUNCTUATION', ',')
        }
        stream.expect('PUNCTUATION', ')')
        return parameters
    }
}
