import { TokenStream } from '../lexer'
import * as model from '../model'
import { CallFuncParser } from './call-func-parser'
import { VariableDeclarationParser } from './variable-declaration-parser'

export class StatementParser {
    private constructor() {}

    static create(): StatementParser {
        return new StatementParser()
    }

    parse(stream: TokenStream): model.Statement {
        if (stream.isNext('KEYWORD', 'const', 'mut')) {
            return VariableDeclarationParser.create({
                tokenStream: stream,
            }).parse()
        } else {
            return CallFuncParser.create(stream).parse()
        }
    }
}
