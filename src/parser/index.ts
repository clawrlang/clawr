import { ASTProgram, ASTStatement } from '../ast'
import { TokenStream } from '../lexer'
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
        const statementParser = this.statementParsers.find((parser) =>
            parser.isNext(),
        )
        return statementParser?.parse()
    }
}
