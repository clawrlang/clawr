import { TokenStream } from '@/lexer'
import { ExtensionDeclaration } from '@/model/extension-declaration'
import { TypeName } from '@/model/type-name'
import { Context, DeclarationParser } from '@/parser'
import { FunctionDeclarationParser } from '@/parser/function-declaration-parser'
import { SourceError } from '@/tools'

export class ExtensionDeclarationParser implements DeclarationParser<ExtensionDeclaration> {
    private readonly functionParser: FunctionDeclarationParser

    private constructor(private context: Context) {
        this.functionParser = FunctionDeclarationParser.create(context)
    }

    static create(context: Context): ExtensionDeclarationParser {
        return new ExtensionDeclarationParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', 'extension')
    }

    parse(stream: TokenStream): ExtensionDeclaration {
        const start = stream.expect('KEYWORD', 'extension')
        const target = stream.expect('IDENTIFIER')
        let conformance: TypeName | undefined
        if (stream.isNext('PUNCTUATION', ':')) {
            stream.next()
            const name = stream.expect('IDENTIFIER')
            conformance = TypeName.create({
                name: name.identifier,
                namespace: this.context.scope?.namespace,
            })
        }

        stream.expect('PUNCTUATION', '{')
        const methods = this.parseMethods(stream)
        let mutating: ReturnType<typeof this.parseMethods> = []
        if (stream.isNext('KEYWORD', 'mutating')) {
            stream.next()
            stream.expect('PUNCTUATION', ':')
            mutating = this.parseMethods(stream, true)
        }
        const end = stream.expect('PUNCTUATION', '}')
        return ExtensionDeclaration.create({
            target: TypeName.create({
                name: target.identifier,
                namespace: this.context.scope?.namespace,
            }),
            conformance,
            methods,
            mutating,
            span: { start: start.start, end: end.end },
        })
    }

    private parseMethods(stream: TokenStream, mutating = false) {
        const methods = []
        while (!stream.isNext('PUNCTUATION', '}')) {
            if (!mutating && stream.isNext('KEYWORD', 'mutating')) break
            if (!stream.isNext('KEYWORD', 'func'))
                throw SourceError.create({
                    message: 'Extensions may only contain methods',
                    span: stream.peek()!,
                })
            methods.push(this.functionParser.parse(stream))
        }
        return methods
    }
}
