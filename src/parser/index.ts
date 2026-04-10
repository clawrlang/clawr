import {
    ASTDataDeclaration,
    ASTForInStatement,
    ASTIfStatement,
    ASTImportDeclaration,
    ASTImportItem,
    ASTProgram,
    ASTReturnStatement,
    ASTStatement,
    ASTWhileStatement,
} from '../ast'
import { TokenStream } from '../lexer'
import type { Token } from '../lexer'
import { ExpressionParser } from './expression-parser'
import { PrintStatementParser } from './statement-parsers/print-statement-parser'
import { DataDeclarationParser } from './statement-parsers/data-declaration-parser'
import { VariableDeclarationParser } from './statement-parsers/variable-declaration-parser'
import { FunctionDeclarationParser } from './statement-parsers/function-declaration-parser'
import { ObjectDeclarationParser } from './statement-parsers/object-declaration-parser'
import { ExpressionStatementParser } from './statement-parsers/expression-statement-parser'

interface StatementParser {
    isNext(): boolean
    parse(): ASTStatement
}

export class Parser {
    private statementParsers: StatementParser[]

    constructor(public stream: TokenStream) {
        this.statementParsers = [
            new VariableDeclarationParser(stream),
            new DataDeclarationParser(stream),
            new FunctionDeclarationParser(stream),
            new ObjectDeclarationParser(stream),
            new PrintStatementParser(stream),
            new ExpressionStatementParser(stream),
        ]
    }

    parse(): ASTProgram {
        const imports: ASTImportDeclaration[] = []
        const body: ASTStatement[] = []
        while (this.stream.peek()) {
            const pendingAnnotations: import('../ast').ASTAnnotation[] =
                this.parseAnnotations()

            const before = this.stream.peek()
            const stmt = this.parseTopLevel(
                imports,
                pendingAnnotations.length ? pendingAnnotations : undefined,
            )
            if (stmt) body.push(stmt)

            if (this.stream.peek() && !this.stream.isNext('NEWLINE')) {
                const next = this.stream.peek()!
                throw new Error(
                    `${this.stream.file}:${next.line}:${next.column}:Expected newline between statements, got ${describeToken(next)}`,
                )
            }

            const after = this.stream.peek()
            if (before && before === after) {
                throw new Error(
                    `${this.stream.file}:${before.line}:${before.column}:Unexpected token ${describeToken(before)} at top level`,
                )
            }
        }
        return { imports, body }
    }

    private parseAnnotations() {
        const pendingAnnotations: import('../ast').ASTAnnotation[] = []
        // Collect annotations before a declaration
        while (this.stream.isNext('PUNCTUATION', '@')) {
            const atToken = this.stream.expect('PUNCTUATION', '@')
            const nameToken = this.stream.expect('IDENTIFIER')
            let args: { [key: string]: any } | undefined = undefined
            if (this.stream.isNext('PUNCTUATION', '(')) {
                this.stream.expect('PUNCTUATION', '(')
                args = {}
                let first = true
                while (!this.stream.isNext('PUNCTUATION', ')')) {
                    if (!first) this.stream.expect('PUNCTUATION', ',')
                    first = false
                    const keyToken = this.stream.expect('IDENTIFIER')
                    let value: any = true
                    if (this.stream.isNext('PUNCTUATION', '=')) {
                        this.stream.expect('PUNCTUATION', '=')
                        const valToken = this.stream.peek()
                        if (valToken?.kind === 'STRING_LITERAL') {
                            const t = this.stream.expect(
                                'STRING_LITERAL' as any,
                            )
                            value = (
                                t as unknown as import('../lexer/token').StringLiteralToken
                            ).value
                        } else if (valToken?.kind === 'INTEGER_LITERAL') {
                            const t = this.stream.expect(
                                'INTEGER_LITERAL' as any,
                            )
                            value = (
                                t as unknown as import('../lexer/token').IntegerLiteralToken
                            ).value
                        } else if (valToken?.kind === 'IDENTIFIER') {
                            value = this.stream.expect('IDENTIFIER').identifier
                        } else {
                            throw new Error(
                                `Unsupported annotation argument value at ${valToken?.line}:${valToken?.column}`,
                            )
                        }
                    }
                    args[keyToken.identifier] = value
                }
                this.stream.expect('PUNCTUATION', ')')
            }
            pendingAnnotations.push({
                name: nameToken.identifier,
                arguments: args,
                position: {
                    file: this.stream.file,
                    line: atToken.line,
                    column: atToken.column,
                },
            })
        }
        return pendingAnnotations
    }

    private parseTopLevel(
        imports: ASTImportDeclaration[],
        annotations?: import('../ast').ASTAnnotation[],
    ): ASTStatement | undefined {
        if (this.stream.isNext('KEYWORD', 'import')) {
            imports.push(this.parseImportDeclaration())
            return undefined
        }

        if (this.stream.isNext('KEYWORD', 'helper')) {
            return this.parseHelperTopLevelDeclaration()
        }

        // Patch annotations into the next declaration if supported
        // Only function, object, and service declarations support annotations
        if (this.stream.isNext('KEYWORD', 'func')) {
            const fnParser = new FunctionDeclarationParser(this.stream)
            const fn = fnParser.parse('public')
            if (annotations && annotations.length) fn.annotations = annotations
            return fn
        }
        if (
            this.stream.isNext('KEYWORD', 'object') ||
            this.stream.isNext('KEYWORD', 'service')
        ) {
            const objParser = new ObjectDeclarationParser(this.stream)
            const decl = objParser.parse('public')
            if (annotations && annotations.length)
                decl.annotations = annotations
            return decl
        }
        // Data declarations could support annotations if desired
        // Otherwise, fallback to normal statement parsing
        return this.parseStatement()
    }

    parseStatement(): ASTStatement | undefined {
        if (this.stream.isNext('KEYWORD', 'if')) {
            return this.parseIfStatement()
        }

        if (this.stream.isNext('KEYWORD', 'while')) {
            return this.parseWhileStatement()
        }

        if (this.stream.isNext('KEYWORD', 'for')) {
            return this.parseForInStatement()
        }

        if (this.stream.isNext('KEYWORD', 'break')) {
            const token = this.stream.expect('KEYWORD', 'break')
            return {
                kind: 'break',
                position: {
                    file: this.stream.file,
                    line: token.line,
                    column: token.column,
                },
            }
        }

        if (this.stream.isNext('KEYWORD', 'continue')) {
            const token = this.stream.expect('KEYWORD', 'continue')
            return {
                kind: 'continue',
                position: {
                    file: this.stream.file,
                    line: token.line,
                    column: token.column,
                },
            }
        }

        if (this.stream.isNext('KEYWORD', 'return')) {
            return this.parseReturnStatement()
        }

        const statementParser = this.statementParsers.find((parser) =>
            parser.isNext(),
        )
        return statementParser?.parse()
    }

    private parseIfStatement(): ASTIfStatement {
        const ifToken = this.stream.expect('KEYWORD', 'if')
        const condition = new ExpressionParser(this.stream).parse()
        const thenBranch = this.parseBlock()
        let elseBranch: ASTStatement[] | undefined

        if (this.stream.isNext('KEYWORD', 'else')) {
            this.stream.expect('KEYWORD', 'else')

            if (this.stream.isNext('KEYWORD', 'if')) {
                elseBranch = [this.parseIfStatement()]
            } else {
                elseBranch = this.parseBlock()
            }
        }

        return {
            kind: 'if',
            condition,
            thenBranch,
            elseBranch,
            position: {
                file: this.stream.file,
                line: ifToken.line,
                column: ifToken.column,
            },
        }
    }

    private parseWhileStatement(): ASTWhileStatement {
        const whileToken = this.stream.expect('KEYWORD', 'while')
        const condition = new ExpressionParser(this.stream).parse()
        const body = this.parseBlock()

        return {
            kind: 'while',
            condition,
            body,
            position: {
                file: this.stream.file,
                line: whileToken.line,
                column: whileToken.column,
            },
        }
    }

    private parseForInStatement(): ASTForInStatement {
        const forToken = this.stream.expect('KEYWORD', 'for')
        const loopVar = this.stream.expect('IDENTIFIER').identifier
        this.stream.expect('KEYWORD', 'in')
        const iterable = new ExpressionParser(this.stream).parse()
        const body = this.parseBlock()

        return {
            kind: 'for-in',
            loopVar,
            iterable,
            body,
            position: {
                file: this.stream.file,
                line: forToken.line,
                column: forToken.column,
            },
        }
    }

    private parseBlock(): ASTStatement[] {
        this.stream.expect('PUNCTUATION', '{')
        const statements: ASTStatement[] = []

        while (!this.stream.isNext('PUNCTUATION', '}')) {
            const stmt = this.parseStatement()
            if (!stmt) {
                const token = this.stream.peek()
                throw new Error(
                    `${token?.line ?? '?'}:${token?.column ?? '?'}:Unexpected token in block: ${JSON.stringify(token)}`,
                )
            }

            statements.push(stmt)

            if (
                !this.stream.isNext('PUNCTUATION', '}') &&
                !this.stream.isNext('NEWLINE')
            ) {
                const next = this.stream.peek()!
                throw new Error(
                    `${this.stream.file}:${next.line}:${next.column}:Expected newline between statements, got ${describeToken(next)}`,
                )
            }
        }

        this.stream.expect('PUNCTUATION', '}')
        return statements
    }

    private parseReturnStatement(): ASTReturnStatement {
        const returnToken = this.stream.expect('KEYWORD', 'return')
        const position = {
            file: this.stream.file,
            line: returnToken.line,
            column: returnToken.column,
        }

        // A return value is present if the next token could start an expression.
        // It is absent if the block ends (`}`) or the stream is exhausted.
        const next = this.stream.peek()
        const isVoid =
            !next || (next.kind === 'PUNCTUATION' && next.symbol === '}')

        if (isVoid) {
            return { kind: 'return', position }
        }

        return {
            kind: 'return',
            value: new ExpressionParser(this.stream).parse(),
            position,
        }
    }

    private parseImportDeclaration(): ASTImportDeclaration {
        const importToken = this.stream.expect('KEYWORD', 'import')
        const items: ASTImportItem[] = []

        while (true) {
            const nextToken = this.stream.peek()
            if (!nextToken) {
                throw new Error(
                    `${this.stream.file}:${importToken.line}:${importToken.column}:Expected identifier in import list, got EOF`,
                )
            }

            if (nextToken.kind !== 'IDENTIFIER') {
                throw new Error(
                    `${this.stream.file}:${nextToken.line}:${nextToken.column}:Expected identifier in import list, got ${describeToken(nextToken)}`,
                )
            }

            const nameToken = this.stream.expect('IDENTIFIER')
            let alias: string | undefined

            if (this.stream.isNext('KEYWORD', 'as')) {
                this.stream.expect('KEYWORD', 'as')
                alias = this.stream.expect('IDENTIFIER').identifier
            }

            items.push({
                name: nameToken.identifier,
                alias,
                position: {
                    file: this.stream.file,
                    line: nameToken.line,
                    column: nameToken.column,
                },
            })

            if (this.stream.isNext('KEYWORD', 'from')) {
                break
            }

            if (!this.stream.isNext('PUNCTUATION', ',')) {
                const separatorToken = this.stream.peek()
                if (!separatorToken) {
                    throw new Error(
                        `${this.stream.file}:${importToken.line}:${importToken.column}:Expected ',' or 'from' after import item, got EOF`,
                    )
                }

                throw new Error(
                    `${this.stream.file}:${separatorToken.line}:${separatorToken.column}:Expected ',' or 'from' after import item, got ${describeToken(separatorToken)}`,
                )
            }

            this.stream.expect('PUNCTUATION', ',')

            if (this.stream.isNext('KEYWORD', 'from')) {
                const fromToken = this.stream.peek()
                throw new Error(
                    `${this.stream.file}:${fromToken?.line ?? importToken.line}:${fromToken?.column ?? importToken.column}:Expected identifier after ',' in import list, got 'from'`,
                )
            }
        }

        const fromToken = this.stream.peek()
        if (!fromToken) {
            throw new Error(
                `${this.stream.file}:${importToken.line}:${importToken.column}:Expected 'from' after import list, got EOF`,
            )
        }

        if (fromToken.kind !== 'KEYWORD' || fromToken.keyword !== 'from') {
            throw new Error(
                `${this.stream.file}:${fromToken.line}:${fromToken.column}:Expected 'from' after import list, got ${describeToken(fromToken)}`,
            )
        }

        this.stream.expect('KEYWORD', 'from')
        const modulePathToken = this.stream.next()
        if (!modulePathToken || modulePathToken.kind !== 'STRING_LITERAL') {
            throw new Error(
                `${this.stream.file}:${fromToken.line}:${fromToken.column}:Expected module path string literal after 'from', got ${modulePathToken ? describeToken(modulePathToken) : 'EOF'}`,
            )
        }
        const modulePath = modulePathToken.value

        return {
            kind: 'import',
            items,
            modulePath,
            position: {
                file: this.stream.file,
                line: importToken.line,
                column: importToken.column,
            },
        }
    }

    private parseHelperTopLevelDeclaration(): ASTStatement {
        const helperToken = this.stream.expect('KEYWORD', 'helper')

        if (this.stream.isNext('KEYWORD', 'data')) {
            const dataDeclaration = this.statementParsers
                .find((parser) => parser instanceof DataDeclarationParser)
                ?.parse() as ASTDataDeclaration | undefined

            if (!dataDeclaration || dataDeclaration.kind !== 'data-decl') {
                throw new Error(
                    `${this.stream.file}:${helperToken.line}:${helperToken.column}:Expected data declaration after helper`,
                )
            }

            return { ...dataDeclaration, visibility: 'helper' }
        }

        if (this.stream.isNext('KEYWORD', 'func')) {
            return new FunctionDeclarationParser(this.stream).parse('helper')
        }

        if (
            this.stream.isNext('KEYWORD', 'object') ||
            this.stream.isNext('KEYWORD', 'service')
        ) {
            return new ObjectDeclarationParser(this.stream).parse('helper')
        }

        throw new Error(
            `${this.stream.file}:${helperToken.line}:${helperToken.column}:helper is only supported before data, func, object, or service declarations`,
        )
    }
}

function describeToken(token: Token): string {
    switch (token.kind) {
        case 'KEYWORD':
            return `'${token.keyword}'`
        case 'PUNCTUATION':
            return `'${token.symbol}'`
        case 'IDENTIFIER':
            return `identifier '${token.identifier}'`
        case 'STRING_LITERAL':
            return 'string literal'
        case 'TRUTH_LITERAL':
            return `truth literal '${token.value}'`
        default:
            return token.kind
    }
}
