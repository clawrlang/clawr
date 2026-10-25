import { TokenStream } from '@/lexer'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { ISOLATION_KEYWORDS, MUTABILITY_KEYWORDS } from '@/model/keywords'
import { VariableDeclaration } from '@/model/variable-declaration'
import { Context } from '@/parser'
import { BindingParser } from '@/parser/binding-parser'
import { ExpressionParser } from '@/parser/expression-parser'
import { StatementParser } from '@/parser/statement-parser'
import { SourceError } from '@/tools'

export class VariableDeclarationParser implements StatementParser<VariableDeclaration> {
    private readonly expressionParser: ExpressionParser
    private readonly bindingParser: BindingParser

    private constructor(context: Context) {
        this.expressionParser = ExpressionParser.create(context)
        this.bindingParser = BindingParser.create(context)
    }

    static create(context: Context): VariableDeclarationParser {
        return new VariableDeclarationParser(context)
    }

    isNext(stream: TokenStream): boolean {
        return stream.isNext('KEYWORD', ...MUTABILITY_KEYWORDS)
    }

    parse(stream: TokenStream): VariableDeclaration {
        const binding = this.bindingParser.parse(stream)
        if (binding.label)
            throw SourceError.create({
                message: 'Variables cannot have labels',
                span: binding.span,
            })
        if (binding.isImmutable === undefined)
            throw SourceError.create({
                message: 'Variables must have explicit mutability',
                span: binding.span,
            })

        stream.expect('PUNCTUATION', '=')
        const initialValue = this.expressionParser.parse(stream)
        if (stream.isNext('KEYWORD', 'as')) {
            stream.next()
            binding.isolationLevel =
                stream.expect('KEYWORD', ...ISOLATION_KEYWORDS).keyword ===
                'cow'
                    ? ISOLATED
                    : SHARED
        }
        return VariableDeclaration.create({
            isImmutable: binding.isImmutable,
            name: binding.name,
            isolationLevel: binding.isolationLevel,
            type: binding.type,
            initialValue,
            span: { start: binding.span.start, end: initialValue.span.end },
            nameSpan: binding.nameSpan,
        })
    }
}
