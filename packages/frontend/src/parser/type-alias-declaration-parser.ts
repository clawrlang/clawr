import { TokenStream } from '@/lexer'
import { TypeAliasDeclaration } from '@/model/type-alias-declaration'
import { IntegerSet, RealSet, TruthvalueSet } from '@/model/value-set'
import { Context } from '@/parser'
import { TypeConstraintParser } from '@/parser/type-constraint-parser'
import { SourceError } from '@/tools'

export class TypeAliasDeclarationParser {
    private constructor(private context: Context) {}

    static create(context: Context): TypeAliasDeclarationParser {
        return new TypeAliasDeclarationParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'subset', 'type')
    }

    parse(stream: TokenStream): TypeAliasDeclaration {
        const declarationToken = stream.expect('KEYWORD', 'subset', 'type')
        const nameToken = stream.expect('IDENTIFIER')
        if (
            ['integer', 'real', 'truthvalue', 'string'].includes(
                nameToken.identifier,
            )
        )
            throw SourceError.create({
                message: `Cannot redefine built-in type ${nameToken.identifier}`,
                span: { start: nameToken.start, end: nameToken.end },
            })
        stream.expect('PUNCTUATION', '=')
        const value = TypeConstraintParser.create(this.context).parse(stream, {
            allowMissingRealPrecision: declarationToken.keyword === 'subset',
        })
        if (
            declarationToken.keyword === 'subset' &&
            value instanceof RealSet &&
            value.precision
        )
            throw SourceError.create({
                message: 'A subset cannot declare real precision',
                span: value.span,
            })
        if (
            declarationToken.keyword === 'subset' &&
            !(value instanceof IntegerSet) &&
            !(value instanceof RealSet) &&
            !(value instanceof TruthvalueSet)
        )
            throw SourceError.create({
                message:
                    'A subset must be based on integer, real, or truthvalue',
                span: value.span,
            })
        const scope = this.context.scope
        if (!scope)
            throw SourceError.create({
                message: 'Named subsets and types require a scope',
                span: { start: declarationToken.start, end: nameToken.end },
            })
        if (!scope.addTypeAlias(nameToken.identifier, value))
            throw SourceError.create({
                message: `Duplicate type alias: ${nameToken.identifier}`,
                span: { start: nameToken.start, end: nameToken.end },
            })
        return TypeAliasDeclaration.create({
            name: nameToken.identifier,
            value,
        })
    }
}
