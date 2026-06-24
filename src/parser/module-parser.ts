import { TokenStream } from '../lexer'
import { DataDeclarationParser } from './data-declaration-parser'
import { BlockParser } from './block-parser'
import { Declaration, Module, Statement } from '../model'

export class ModuleParser {
    private constructor(
        private blockParser: BlockParser,
        private dataDeclarationParser: DataDeclarationParser,
    ) {}

    static create(): ModuleParser {
        return new ModuleParser(
            BlockParser.create(),
            DataDeclarationParser.create(),
        )
    }

    parse(stream: TokenStream): Module {
        let main: Statement[] | undefined = undefined
        const declarations: Declaration[] = []

        while (stream.peek()) {
            if (stream.isNext('ANNOTATION', '@main')) {
                if (main !== undefined) {
                    throw new Error('Multiple @main blocks found')
                }

                stream.expect('ANNOTATION', '@main')
                main = this.blockParser.parse(stream)
            } else if (stream.isNext('KEYWORD', 'data')) {
                declarations.push(this.dataDeclarationParser.parse(stream))
            } else {
                throw new Error(
                    `Unexpected token kind: ${stream.peek()?.kind} while parsing module`,
                )
            }
        }
        return Module.create({ main, declarations })
    }
}
