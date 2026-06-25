import { TokenStream } from '../lexer'
import { DataDeclarationParser } from './data-declaration-parser'
import { BlockParser } from './block-parser'
import { Declaration, Statement } from '../model'
import { Module } from '../model/module'
import { ErrorReporter } from '../diagnostics'

export class ModuleParser {
    private constructor(
        private blockParser: BlockParser,
        private dataDeclarationParser: DataDeclarationParser,
        private errorReporter: ErrorReporter,
    ) {}

    static create({
        errorReporter,
    }: {
        errorReporter: ErrorReporter
    }): ModuleParser {
        return new ModuleParser(
            BlockParser.create({ errorReporter }),
            DataDeclarationParser.create({ errorReporter }),
            errorReporter,
        )
    }

    parse(stream: TokenStream): Module {
        let main: Statement[] | undefined = undefined
        const declarations: Declaration[] = []

        while (stream.peek()) {
            if (stream.isNext('ANNOTATION', '@main')) {
                if (main !== undefined) {
                    const { start, end } = stream.peek()!!
                    this.errorReporter.reportFatalError(
                        'Multiple @main blocks found',
                        { start, end },
                    )
                }

                stream.expect('ANNOTATION', '@main')
                main = this.blockParser.parse(stream)
            } else if (stream.isNext('KEYWORD', 'data')) {
                declarations.push(this.dataDeclarationParser.parse(stream))
            } else {
                const { start, end } = stream.peek()!!
                this.errorReporter.reportFatalError(
                    `Unexpected token kind: ${stream.peek()?.kind} while parsing module`,
                    { start, end },
                )
            }
        }
        return Module.create({ main, declarations })
    }
}
