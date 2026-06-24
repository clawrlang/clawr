import { TokenStream } from '../lexer'
import * as model from '../model'
import { DataDeclarationParser } from './data-declaration-parser'
import { StatementParser } from './statement-parser'

export class ModuleParser {
    private constructor(
        private statementParser: StatementParser,
        private dataDeclarationParser: DataDeclarationParser,
    ) {}

    static create(): ModuleParser {
        return new ModuleParser(
            StatementParser.create(),
            DataDeclarationParser.create(),
        )
    }

    parse(stream: TokenStream): model.Module {
        let main: model.Statement[] | undefined = undefined
        const declarations: model.Declaration[] = []

        while (stream.peek()) {
            if (stream.isNext('ANNOTATION', '@main')) {
                if (main !== undefined) {
                    throw new Error('Multiple @main blocks found')
                }

                stream.expect('ANNOTATION', '@main')
                stream.expect('PUNCTUATION', '{')
                main = this.parseStatements(stream)
                stream.expect('PUNCTUATION', '}')
            } else if (stream.isNext('KEYWORD', 'data')) {
                declarations.push(this.dataDeclarationParser.parse(stream))
            } else {
                throw new Error(
                    `Unexpected token kind: ${stream.peek()?.kind} while parsing module`,
                )
            }
        }
        return model.Module.create({ main, declarations })
    }
    private parseStatements(stream: TokenStream): model.Statement[] {
        const statements: model.Statement[] = []
        while (!stream.isNext('PUNCTUATION', '}')) {
            statements.push(this.statementParser.parse(stream))
        }
        return statements
    }
}
