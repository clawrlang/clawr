import { TestErrorReporter } from '../../tests/util'
import { ValueSet } from '../cir'
import { TokenStream, Token } from '../lexer'
import { FunctionDeclaration, Parameter } from '../model/function-declaration'
import { ReturnStatement } from '../model/return-statement'
import { BlockParser } from './block-parser'
import { ExpressionParser } from './expression-parser'

export class FunctionParser {
    private constructor(private errorReporter: TestErrorReporter) {}

    static create({
        errorReporter,
    }: {
        errorReporter: TestErrorReporter
    }): FunctionParser {
        return new FunctionParser(errorReporter)
    }

    parse(stream: TokenStream): FunctionDeclaration {
        stream.expect('KEYWORD', 'func')
        const nameToken = stream.expect('IDENTIFIER')
        const name = nameToken.identifier

        const parameters = this.parseParameters(stream)

        let returnValueSet: ValueSet | undefined = undefined
        if (stream.isNext('OPERATOR', '->')) {
            stream.expect('OPERATOR', '->')
            stream.expect('IDENTIFIER')
            returnValueSet = { type: 'integer' }
        }

        if (stream.isNext('PUNCTUATION', '=>')) {
            stream.expect('PUNCTUATION', '=>')
            const returnExpression = ExpressionParser.create({
                errorReporter: this.errorReporter,
            }).parse(stream)

            return FunctionDeclaration.create({
                name,
                parameters,
                returnValueSet: undefined,
                body: [ReturnStatement.create(returnExpression)],
            })
        }

        const body = BlockParser.create({
            errorReporter: this.errorReporter,
        }).parse(stream)

        return FunctionDeclaration.create({
            name,
            parameters,
            returnValueSet,
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
            const typeToken = stream.expect('IDENTIFIER')
            const type = typeToken.identifier

            parameters.push(
                Parameter.create({
                    label:
                        labelToken.identifier === '_'
                            ? undefined
                            : labelToken.identifier,
                    varName: varNameToken.identifier,
                    type,
                }),
            )

            if (!stream.isNext('PUNCTUATION', ')'))
                stream.expect('PUNCTUATION', ',')
        }
        stream.expect('PUNCTUATION', ')')
        return parameters
    }
}
