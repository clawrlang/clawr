import { TokenStream } from '../lexer'
import { DataDeclarationParser } from './data-declaration-parser'
import { BlockParser } from './block-parser'
import { Declaration, Statement } from '../model'
import { Module } from '../model/module'
import { Context, DeclarationParser } from '.'
import { VariableDeclarationParser } from './variable-declaration-parser'
import { VARIABLE_SEMANTICS } from '../model/variable-declaration'
import { FunctionParser } from './function-parser'
import { ObjectParser } from './object-parser'

export class ModuleParser {
    private blockParser: BlockParser
    private declarationParsers: DeclarationParser<Declaration>[]

    private constructor(private context: Context) {
        this.blockParser = BlockParser.create(context)
        this.declarationParsers = [
            DataDeclarationParser.create(context),
            VariableDeclarationParser.create(context),
            FunctionParser.create(context),
            ObjectParser.create(context),
        ]
    }

    static create(context: Context): ModuleParser {
        return new ModuleParser(context)
    }

    parse(stream: TokenStream): Module {
        let main: Statement[] | undefined = undefined
        const declarations: Declaration[] = []

        while (stream.peek()) {
            if (stream.isNext('ANNOTATION', '@main')) {
                if (main !== undefined) {
                    const { start, end } = stream.peek()!!
                    this.context.errorReporter.reportFatalError(
                        'Multiple @main blocks found',
                        { start, end },
                    )
                }

                stream.expect('ANNOTATION', '@main')
                main = this.blockParser.parse(stream)
            } else {
                const parser = this.declarationParsers.find((parser) =>
                    parser.isNext(stream),
                )
                if (!parser) {
                    const { start, end } = stream.peek()!!
                    this.context.errorReporter.reportFatalError(
                        `Unexpected token kind: ${stream.peek()?.kind} while parsing module`,
                        { start, end },
                    )
                }
                declarations.push(parser!.parse(stream))
            }
        }
        return Module.create({ main, declarations })
    }
}
