import { TokenStream } from '@/lexer'
import { Expression } from '@/model'
import { FunctionDeclaration } from '@/model/function-declaration'
import { MethodSignature } from '@/model/interface-declaration'
import { ISOLATED, SHARED, UNIQUE, UNKNOWN } from '@/model/isolation-level'
import { ISOLATION_KEYWORDS, IsolationKeyword } from '@/model/keywords'
import { Parameter } from '@/model/parameter'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { RCTypeSet } from '@/model/value-set'
import { Context, DeclarationParser } from '@/parser'
import { BindingParser } from '@/parser/binding-parser'
import { BlockParser } from '@/parser/block-parser'
import { ExpressionParser } from '@/parser/expression-parser'
import { TypeConstraintParser } from '@/parser/type-constraint-parser'

export class FunctionDeclarationParser implements DeclarationParser<FunctionDeclaration> {
    private readonly bindingParser: BindingParser
    private readonly typeConstraintParser: TypeConstraintParser

    private constructor(private context: Context) {
        this.typeConstraintParser = TypeConstraintParser.create(context)
        this.bindingParser = BindingParser.create(context)
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

    parseSignature(stream: TokenStream): MethodSignature {
        const funcToken = stream.expect('KEYWORD', 'func')
        const nameToken = stream.expect('IDENTIFIER')
        const parameters = this.parseParameters(stream)
        const result = this.parseReturnType(stream)
        const last = parameters.at(-1)
        return MethodSignature.create({
            baseName: nameToken.identifier,
            parameters,
            result: result?.type,
            span: {
                start: funcToken.start,
                end: result?.type.span?.end ?? last?.span.end ?? nameToken.end,
            },
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
            const binding = this.bindingParser.parse(stream)

            let defaultValue: Expression | undefined
            if (stream.isNext('PUNCTUATION', '=')) {
                stream.expect('PUNCTUATION', '=')
                defaultValue = ExpressionParser.create(this.context).parse(
                    stream,
                )
            }

            parameters.push(
                Parameter.create({
                    isImmutable: binding.isImmutable !== false,
                    label:
                        binding.label === '_'
                            ? undefined
                            : (binding.label ?? binding.name),
                    varName: binding.name,
                    isolationLevel:
                        binding.isolationLevel ??
                        (binding.type instanceof RCTypeSet
                            ? UNKNOWN
                            : ISOLATED),
                    type: binding.type,
                    defaultValue,
                    span: {
                        start: binding.span.start,
                        end: defaultValue?.span.end ?? binding.span.end,
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
    ): [TypeConstraintDeclaration, IsolationKeyword | undefined] | undefined {
        if (!stream.isNext('PUNCTUATION', ':')) return undefined
        stream.expect('PUNCTUATION', ':')
        const isolationToken = stream.isNext('KEYWORD', ...ISOLATION_KEYWORDS)
            ? stream.expect('KEYWORD', ...ISOLATION_KEYWORDS)
            : undefined
        return [
            this.typeConstraintParser.parse(stream),
            isolationToken?.keyword,
        ]
    }
}
