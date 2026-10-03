import { TokenStream } from '@/lexer'
import { Declaration, Statement } from '@/model'
import { Module } from '@/model/module'
import { Context, DeclarationParser } from '@/parser'
import { BlockParser } from '@/parser/block-parser'
import { DataDeclarationParser } from '@/parser/data-declaration-parser'
import { FunctionDeclarationParser } from '@/parser/function-declaration-parser'
import { ObjectDeclarationParser } from '@/parser/object-declaration-parser'
import { VariableDeclarationParser } from '@/parser/variable-declaration-parser'
import { SourceError } from '@/tools'

export class ModuleParser {
    private blockParser: BlockParser
    private declarationParsers: DeclarationParser<Declaration>[]

    private constructor(private context: Context) {
        this.blockParser = BlockParser.create(context)
        this.declarationParsers = [
            DataDeclarationParser.create(context),
            VariableDeclarationParser.create(context),
            FunctionDeclarationParser.create(context),
            ObjectDeclarationParser.create(context),
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
                    throw SourceError.create({
                        message: 'Multiple @main blocks found',
                        span: { start, end },
                    })
                }

                stream.expect('ANNOTATION', '@main')
                main = this.blockParser.parse(stream)
            } else {
                const parser = this.declarationParsers.find((parser) =>
                    parser.isNext(stream),
                )
                if (!parser) {
                    const { start, end } = stream.peek()!!
                    throw SourceError.create({
                        message: `Unexpected token kind: ${stream.peek()?.kind} while parsing module`,
                        span: { start, end },
                    })
                }
                declarations.push(parser!.parse(stream))
            }
        }
        return Module.create({ main, declarations })
    }
}
