import { ErrorReporter } from '../diagnostics'
import { TokenStream } from '../lexer'
import { Declaration } from '../model'

export type Context = {
    errorReporter: ErrorReporter
    type?: string
    semantics?: 'SHARED' | 'ISOLATED'
}

export { ModuleParser } from './module-parser'

export interface DeclarationParser<Decl extends Declaration> {
    isNext(stream: TokenStream): boolean
    parse(stream: TokenStream): Decl
}
