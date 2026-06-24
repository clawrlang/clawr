import { TokenStream } from '../lexer'
import * as model from '../model'
import { DataDeclarationParser } from './data-declaration-parser'
import { BlockParser } from './block-parser'

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

    parse(stream: TokenStream): model.Module {
        let main: model.Statement[] | undefined = undefined
        const declarations: model.Declaration[] = []

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
        return model.Module.create({ main, declarations })
    }
}
