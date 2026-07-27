import { Context, DeclarationParser } from '.'
import { TokenStream, Token } from '../lexer'
import { FunctionDeclaration, Parameter } from '../model/function-declaration'
import { ExplicitValueSet } from '../model/explicit-value-set'
import { BlockParser } from './block-parser'
import { ExpressionParser } from './expression-parser'
import { ValueSetParser } from './value-set-parser'
import {
    VARIABLE_SEMANTICS,
    VariableSemantics,
} from '../model/variable-declaration'
import { Expression } from '../model'

export class FunctionParser implements DeclarationParser<FunctionDeclaration> {
    private readonly valueSetParser: ValueSetParser

    private constructor(private context: Context) {
        this.valueSetParser = ValueSetParser.create(context)
    }

    static create(context: Context): FunctionParser {
        return new FunctionParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'func')
    }

    parse(stream: TokenStream): FunctionDeclaration {
        stream.expect('KEYWORD', 'func')
        const nameToken = stream.expect('IDENTIFIER')
        const baseName = nameToken.identifier

        const parameters = this.parseParameters(stream)

        let result: ExplicitValueSet | undefined = undefined
        if (stream.isNext('OPERATOR', '->')) {
            stream.expect('OPERATOR', '->')
            const semanticsToken = stream.isNext('KEYWORD', 'ref', 'const')
                ? stream.expect('KEYWORD', 'ref', 'const')
                : undefined
            result = this.valueSetParser.parse(
                stream,
                semanticsToken?.keyword as 'const' | 'ref',
            )
        }

        if (stream.isNext('PUNCTUATION', '=>')) {
            stream.expect('PUNCTUATION', '=>')
            const returnExpression = ExpressionParser.create(
                this.context,
            ).parse(stream)

            return FunctionDeclaration.create({
                baseName,
                parameters,
                result,
                implementation: {
                    kind: 'implicit-return',
                    expression: returnExpression,
                },
            })
        }

        const statements = BlockParser.create(this.context).parse(stream)

        return FunctionDeclaration.create({
            baseName,
            parameters,
            result,
            implementation: { kind: 'body', statements },
        })
    }

    private parseParameters(stream: TokenStream) {
        stream.expect('PUNCTUATION', '(')
        const parameters: Parameter[] = []
        while (!stream.isNext('PUNCTUATION', ')')) {
            let semanticsToken: Token | undefined
            let semantics: VariableSemantics | undefined
            if (stream.isNext('KEYWORD', ...VARIABLE_SEMANTICS)) {
                semanticsToken = stream.expect('KEYWORD', ...VARIABLE_SEMANTICS)
                semantics = semanticsToken.keyword as VariableSemantics
            }
            const labelToken = stream.expect('IDENTIFIER')
            let varNameToken: (Token & { kind: 'IDENTIFIER' }) | undefined

            if (stream.isNext('IDENTIFIER'))
                varNameToken = stream.expect('IDENTIFIER')
            else varNameToken = labelToken

            let valueSet: ExplicitValueSet | undefined
            if (stream.isNext('PUNCTUATION', ':')) {
                stream.expect('PUNCTUATION', ':')
                valueSet = this.valueSetParser.parse(stream)
            }

            let defaultValue: Expression | undefined
            if (stream.isNext('PUNCTUATION', '=')) {
                stream.expect('PUNCTUATION', '=')
                defaultValue = ExpressionParser.create(this.context).parse(
                    stream,
                )
            }

            parameters.push(
                Parameter.create({
                    label:
                        labelToken.identifier === '_'
                            ? undefined
                            : labelToken.identifier,
                    varName: varNameToken.identifier,
                    valueSet,
                    semantics,
                    defaultValue,
                    span: {
                        start: semanticsToken?.start ?? labelToken.start,
                        end:
                            defaultValue?.span.end ??
                            valueSet?.span.end ??
                            varNameToken.end,
                    },
                }),
            )

            if (!stream.isNext('PUNCTUATION', ')'))
                stream.expect('PUNCTUATION', ',')
        }
        stream.expect('PUNCTUATION', ')')
        return parameters
    }
}
