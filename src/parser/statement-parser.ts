import { TokenStream } from '@/lexer'
import { Statement } from '@/model'

export interface StatementParser<T extends Statement> {
    isNext(stream: TokenStream): boolean
    parse(stream: TokenStream): T
}
