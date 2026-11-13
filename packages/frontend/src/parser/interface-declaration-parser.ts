import { TokenStream } from '@/lexer'
import { InterfaceDeclaration } from '@/model/interface-declaration'
import { TypeName } from '@/model/type-name'
import { Context, DeclarationParser } from '@/parser'
import { FunctionDeclarationParser } from '@/parser/function-declaration-parser'

export class InterfaceDeclarationParser implements DeclarationParser<InterfaceDeclaration> {
    private readonly functionParser: FunctionDeclarationParser

    private constructor(private context: Context) {
        this.functionParser = FunctionDeclarationParser.create(context)
    }

    static create(context: Context): InterfaceDeclarationParser {
        return new InterfaceDeclarationParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'trait', 'role')
    }

    parse(stream: TokenStream): InterfaceDeclaration {
        const startToken = stream.expect('KEYWORD', 'trait', 'role')
        const nameToken = stream.expect('IDENTIFIER')
        const inherits: string[] = []
        if (stream.isNext('PUNCTUATION', ':')) {
            stream.next()
            do {
                const token = stream.expect('IDENTIFIER')
                inherits.push(token.identifier)
                this.context.definitionRecorder?.typeReference(
                    token.identifier,
                    {
                        start: token.start,
                        end: token.end,
                    },
                )
            } while (stream.isNext('PUNCTUATION', ',') && stream.next())
        }
        stream.expect('PUNCTUATION', '{')
        const methods = []
        while (!stream.isNext('PUNCTUATION', '}'))
            methods.push(this.functionParser.parseSignature(stream))
        const endToken = stream.expect('PUNCTUATION', '}')
        return InterfaceDeclaration.create({
            kind: startToken.keyword as 'trait' | 'role',
            name: TypeName.create({
                name: nameToken.identifier,
                namespace: this.context.scope?.namespace,
            }),
            methods,
            inherits,
            nameSpan: { start: nameToken.start, end: nameToken.end },
            span: { start: startToken.start, end: endToken.end },
        })
    }
}
