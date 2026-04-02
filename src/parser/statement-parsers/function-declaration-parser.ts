import type {
    ASTFunctionDeclaration,
    ASTFunctionParameter,
    ASTVisibility,
} from '../../ast'
import { TokenStream } from '../../lexer'
import { ExpressionParser } from '../expression-parser'
import { Parser } from '../index'

export class FunctionDeclarationParser {
    constructor(private stream: TokenStream) {}

    isNext(): boolean {
        const token = this.stream.peek()
        return token?.kind === 'KEYWORD' && token.keyword === 'func'
    }

    parse(visibility: ASTVisibility = 'public'): ASTFunctionDeclaration {
        const funcToken = this.stream.expect('KEYWORD', 'func')
        const name = this.stream.expect('IDENTIFIER').identifier

        const parameters = this.parseParameters()

        // Optional return type annotation `-> Type` or `-> const Type` / `-> ref Type`
        let returnType: string | undefined
        let returnSemantics: 'const' | 'ref' | undefined

        if (this.stream.isNext('PUNCTUATION', '->')) {
            this.stream.expect('PUNCTUATION', '->')
            const maybeSemantics = this.stream.peek()
            if (
                maybeSemantics?.kind === 'KEYWORD' &&
                (maybeSemantics.keyword === 'const' ||
                    maybeSemantics.keyword === 'ref')
            ) {
                returnSemantics = maybeSemantics.keyword
                this.stream.next()
            }
            returnType = this.stream.expect('IDENTIFIER').identifier
        }

        // Body: `=> expr` or `{ stmts }`
        if (this.stream.isNext('PUNCTUATION', '=>')) {
            this.stream.expect('PUNCTUATION', '=>')
            const value = new ExpressionParser(this.stream).parse()
            return {
                kind: 'func-decl',
                name,
                visibility,
                parameters,
                returnType,
                returnSemantics,
                body: { kind: 'expression', value },
                position: { line: funcToken.line, column: funcToken.column },
            }
        }

        this.stream.expect('PUNCTUATION', '{')
        const statements = []
        const bodyParser = new Parser(this.stream)
        while (!this.stream.isNext('PUNCTUATION', '}')) {
            const stmt = bodyParser.parseStatement()
            if (!stmt) {
                throw new Error(
                    `Unexpected token in function body: ${JSON.stringify(this.stream.peek())}`,
                )
            }
            statements.push(stmt)
        }
        this.stream.expect('PUNCTUATION', '}')

        return {
            kind: 'func-decl',
            name,
            visibility,
            parameters,
            returnType,
            returnSemantics,
            body: { kind: 'block', statements },
            position: { line: funcToken.line, column: funcToken.column },
        }
    }

    private parseParameters(): ASTFunctionParameter[] {
        this.stream.expect('PUNCTUATION', '(')
        const params: ASTFunctionParameter[] = []

        while (!this.stream.isNext('PUNCTUATION', ')')) {
            if (params.length > 0) {
                this.stream.expect('PUNCTUATION', ',')
            }

            // Optional parameter semantics prefix
            let semantics: 'const' | 'mut' | 'ref' | undefined
            const maybeSem = this.stream.peek()
            if (
                maybeSem?.kind === 'KEYWORD' &&
                (maybeSem.keyword === 'const' ||
                    maybeSem.keyword === 'mut' ||
                    maybeSem.keyword === 'ref')
            ) {
                semantics = maybeSem.keyword
                this.stream.next()
            }

            // Either `label name: Type` or just `name: Type`
            // We use attempt() to decide: peek two identifiers before ':'
            const firstToken = this.stream.expect('IDENTIFIER')
            let label: string | undefined
            let paramName: string

            if (this.stream.isNext('IDENTIFIER')) {
                // Two identifiers in a row → first is label, second is name
                label = firstToken.identifier
                paramName = this.stream.expect('IDENTIFIER').identifier
            } else {
                // Single identifier → no label, just name
                paramName = firstToken.identifier
            }

            this.stream.expect('PUNCTUATION', ':')
            const paramType = this.stream.expect('IDENTIFIER').identifier

            params.push({
                label,
                name: paramName,
                type: paramType,
                semantics,
                position: {
                    line: firstToken.line,
                    column: firstToken.column,
                },
            })
        }

        this.stream.expect('PUNCTUATION', ')')
        return params
    }
}
