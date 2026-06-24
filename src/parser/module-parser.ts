import { TokenStream } from '../lexer'
import * as model from '../model'
import { DataDeclarationParser } from './data-declaration-parser'
import { StatementParser } from './statement-parser'

export class ModuleParser {
    private constructor(
        private tokenStream: TokenStream,
        private statementParser: StatementParser,
    ) {}

    static create(tokenStream: TokenStream): ModuleParser {
        return new ModuleParser(tokenStream, StatementParser.create())
    }

    parse(): model.Module {
        let main: model.Statement[] | undefined = undefined
        const declarations: model.Declaration[] = []

        while (this.tokenStream.peek()) {
            if (this.tokenStream.isNext('ANNOTATION', '@main')) {
                if (main !== undefined) {
                    throw new Error('Multiple @main blocks found')
                }

                this.tokenStream.expect('ANNOTATION', '@main')
                this.tokenStream.expect('PUNCTUATION', '{')
                main = this.parseStatements()
                this.tokenStream.expect('PUNCTUATION', '}')
            } else if (this.tokenStream.isNext('KEYWORD', 'data')) {
                declarations.push(
                    DataDeclarationParser.create({
                        tokenStream: this.tokenStream,
                    }).parse(),
                )
            } else {
                throw new Error(
                    `Unexpected token kind: ${this.tokenStream.peek()?.kind} while parsing module`,
                )
            }
        }
        return model.Module.create({ main, declarations })
    }
    private parseStatements() {
        const statements: model.Statement[] = []
        while (!this.tokenStream.isNext('PUNCTUATION', '}')) {
            statements.push(this.statementParser.parse(this.tokenStream))
        }
        return statements
    }
}
