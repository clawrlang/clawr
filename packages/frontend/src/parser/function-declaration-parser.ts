import { Token, TokenStream } from '@/lexer'
import { Expression } from '@/model'
import { FunctionDeclaration } from '@/model/function-declaration'
import { ISOLATED, SHARED, UNIQUE, UNKNOWN } from '@/model/isolation-level'
import { Parameter } from '@/model/parameter'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { Context, DeclarationParser } from '@/parser'
import { BlockParser } from '@/parser/block-parser'
import { ExpressionParser } from '@/parser/expression-parser'
import {
    SemanticsKeyword,
    SemanticsKeywordParser,
} from '@/parser/semantics-keyword-parser'
import { TypeConstraintParser } from '@/parser/type-constraint-parser'

export class FunctionDeclarationParser implements DeclarationParser<FunctionDeclaration> {
    private readonly typeConstraintParser: TypeConstraintParser

    private constructor(private context: Context) {
        this.typeConstraintParser = TypeConstraintParser.create(context)
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
        const result = this.parseReturnType(stream)

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

    private parseReturnType(stream: TokenStream) {
        if (stream.isNext('OPERATOR', '->')) {
            stream.expect('OPERATOR', '->')
            const isolationLevel = this.parseIsolationlevel(stream)
            return {
                type: this.typeConstraintParser.parse(stream),
                isolationLevel,
            }
        }
    }

    private parseIsolationlevel(stream: TokenStream) {
        const semanticsToken = stream.isNext('KEYWORD', 'ref', 'const')
            ? stream.expect('KEYWORD', 'ref', 'const')
            : undefined

        switch (semanticsToken?.keyword) {
            case 'const':
                return ISOLATED
            case 'ref':
                return SHARED
            default:
                return UNIQUE
        }
    }

    private parseParameters(stream: TokenStream) {
        stream.expect('PUNCTUATION', '(')
        const parameters: Parameter[] = []
        while (!stream.isNext('PUNCTUATION', ')')) {
            const semanticsToken = SemanticsKeywordParser.readToken(stream)
            const semanticsKeyword = semanticsToken
                ? SemanticsKeyword[semanticsToken.keyword]
                : undefined
            const labelToken = stream.expect('IDENTIFIER')
            let varNameToken: (Token & { kind: 'IDENTIFIER' }) | undefined

            if (stream.isNext('IDENTIFIER'))
                varNameToken = stream.expect('IDENTIFIER')
            else varNameToken = labelToken

            const type = this.parseTypeConstraint(stream)

            let defaultValue: Expression | undefined
            if (stream.isNext('PUNCTUATION', '=')) {
                stream.expect('PUNCTUATION', '=')
                defaultValue = ExpressionParser.create(this.context).parse(
                    stream,
                )
            }

            parameters.push(
                Parameter.create({
                    isImmutable: semanticsKeyword?.isImmutable ?? true,
                    label:
                        labelToken.identifier === '_'
                            ? undefined
                            : labelToken.identifier,
                    varName: varNameToken.identifier,
                    isolationLevel: semanticsKeyword?.isolationLevel ?? UNKNOWN,
                    type: type,
                    defaultValue,
                    span: {
                        start: semanticsToken?.start ?? labelToken.start,
                        end:
                            defaultValue?.span.end ??
                            type?.span?.end ??
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

    private parseTypeConstraint(
        stream: TokenStream,
    ): TypeConstraintDeclaration | undefined {
        if (!stream.isNext('PUNCTUATION', ':')) return undefined
        stream.expect('PUNCTUATION', ':')
        return this.typeConstraintParser.parse(stream)
    }
}
