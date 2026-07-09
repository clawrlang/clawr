import { TokenStream } from '../lexer'
import { DataDeclarationParser } from './data-declaration-parser'
import { BlockParser } from './block-parser'
import { Declaration, Statement } from '../model'
import { Module } from '../model/module'
import { Context } from '.'
import { VariableDeclarationParser } from './variable-declaration-parser'
import { VARIABLE_SEMANTICS } from '../model/variable-declaration'
import { FunctionParser } from './function-parser'

export class ModuleParser {
    private blockParser: BlockParser
    private dataDeclarationParser: DataDeclarationParser
    private variableDeclarationParser: VariableDeclarationParser
    private functionParser: FunctionParser

    private constructor(private context: Context) {
        this.blockParser = BlockParser.create(context)
        this.dataDeclarationParser = DataDeclarationParser.create(context)
        this.variableDeclarationParser =
            VariableDeclarationParser.create(context)
        this.functionParser = FunctionParser.create(context)
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
            } else if (stream.isNext('KEYWORD', 'data')) {
                declarations.push(this.dataDeclarationParser.parse(stream))
            } else if (stream.isNext('KEYWORD', ...VARIABLE_SEMANTICS)) {
                declarations.push(this.variableDeclarationParser.parse(stream))
            } else if (stream.isNext('KEYWORD', 'func')) {
                declarations.push(this.functionParser.parse(stream))
            } else {
                const { start, end } = stream.peek()!!
                this.context.errorReporter.reportFatalError(
                    `Unexpected token kind: ${stream.peek()?.kind} while parsing module`,
                    { start, end },
                )
            }
        }
        return Module.create({ main, declarations })
    }
}
