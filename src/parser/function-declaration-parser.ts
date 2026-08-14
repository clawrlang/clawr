import { Context, DeclarationParser } from '.'
import { TokenStream, Token } from '../lexer'
import { FunctionDeclaration, Parameter } from '../model/function-declaration'
import { ExplicitValueSet } from '../model/explicit-value-set'
import { BlockParser } from './block-parser'
import { ExpressionParser } from './expression-parser'
import { ValueSetParser } from './value-set-parser'
import { Expression } from '../model'
import {
    SemanticsKeyword,
    SemanticsKeywordParser,
} from './semantics-keyword-parser'

export class FunctionDeclarationParser implements DeclarationParser<FunctionDeclaration> {
    private readonly valueSetParser: ValueSetParser

    private constructor(private context: Context) {
        this.valueSetParser = ValueSetParser.create(context)
    }

    static create(context: Context): FunctionDeclarationParser {
        return new FunctionDeclarationParser(context)
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
            result = this.valueSetParser.parse(stream, 'ISOLATED')
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
            const semanticsToken = SemanticsKeywordParser.readToken(stream)
            const semanticsKeyword = semanticsToken
                ? SemanticsKeyword[semanticsToken.keyword]
                : SemanticsKeyword.const
            const labelToken = stream.expect('IDENTIFIER')
            let varNameToken: (Token & { kind: 'IDENTIFIER' }) | undefined

            if (stream.isNext('IDENTIFIER'))
                varNameToken = stream.expect('IDENTIFIER')
            else varNameToken = labelToken

            let valueSet: ExplicitValueSet | undefined
            if (stream.isNext('PUNCTUATION', ':')) {
                stream.expect('PUNCTUATION', ':')
                valueSet = this.valueSetParser.parse(
                    stream,
                    semanticsKeyword.isolationLevel,
                )
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
                    ...semanticsKeyword,
                    label:
                        labelToken.identifier === '_'
                            ? undefined
                            : labelToken.identifier,
                    varName: varNameToken.identifier,
                    valueSet,
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
