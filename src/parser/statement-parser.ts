import { TokenStream } from '../lexer'
import * as model from '../model'
import { CallFuncParser } from './call-func-parser'
import { VariableDeclarationParser } from './variable-declaration-parser'

export class StatementParser {
    private constructor(
        private callFuncParser: CallFuncParser,
        private variableDeclarationParser: VariableDeclarationParser,
    ) {}

    static create(): StatementParser {
        return new StatementParser(
            CallFuncParser.create(),
            VariableDeclarationParser.create(),
        )
    }

    parse(stream: TokenStream): model.Statement {
        if (stream.isNext('KEYWORD', 'const', 'mut')) {
            return this.variableDeclarationParser.parse(stream)
        } else {
            return this.callFuncParser.parse(stream)
        }
    }
}
