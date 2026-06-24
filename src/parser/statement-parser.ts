import { TokenStream } from '../lexer'
import * as model from '../model'

export interface StatementParser<T extends model.Statement> {
    isNext(stream: TokenStream): boolean
    parse(stream: TokenStream): T
}
