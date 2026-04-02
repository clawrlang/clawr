import {
    ASTIfStatement,
    ASTProgram,
    ASTStatement,
    ASTWhileStatement,
} from '../ast'
import { TokenStream } from '../lexer'
import { ExpressionParser } from './expression-parser'
import { PrintStatementParser } from './statement-parsers/print-statement-parser'
import { DataDeclarationParser } from './statement-parsers/data-declaration-parser'
import { VariableDeclarationParser } from './statement-parsers/variable-declaration-parser'
import { AssignmentParser } from './statement-parsers/assignment-parser'

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
            new PrintStatementParser(stream),
            new AssignmentParser(stream),
        ]
    }

    parse(): ASTProgram {
        const body: ASTStatement[] = []
        while (this.stream.peek()) {
            const stmt = this.parseStatement()
            if (stmt) {
                body.push(stmt)
            } else {
                throw new Error(
                    `Unexpected token: ${JSON.stringify(this.stream.peek())}`,
                )
            }
        }
        return { body }
    }

    private parseStatement(): ASTStatement | undefined {
        if (this.stream.isNext('KEYWORD', 'if')) {
            return this.parseIfStatement()
        }

        if (this.stream.isNext('KEYWORD', 'while')) {
            return this.parseWhileStatement()
        }

        if (this.stream.isNext('KEYWORD', 'break')) {
            const token = this.stream.expect('KEYWORD', 'break')
            return {
                kind: 'break',
                position: { line: token.line, column: token.column },
            }
        }

        if (this.stream.isNext('KEYWORD', 'continue')) {
            const token = this.stream.expect('KEYWORD', 'continue')
            return {
                kind: 'continue',
                position: { line: token.line, column: token.column },
            }
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
            position: { line: ifToken.line, column: ifToken.column },
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
            position: { line: whileToken.line, column: whileToken.column },
        }
    }

    private parseBlock(): ASTStatement[] {
        this.stream.expect('PUNCTUATION', '{')
        const statements: ASTStatement[] = []

        while (!this.stream.isNext('PUNCTUATION', '}')) {
            const stmt = this.parseStatement()
            if (!stmt) {
                throw new Error(
                    `Unexpected token in block: ${JSON.stringify(this.stream.peek())}`,
                )
            }

            statements.push(stmt)
        }

        this.stream.expect('PUNCTUATION', '}')
        return statements
    }
}
