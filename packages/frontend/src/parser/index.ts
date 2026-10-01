import { TokenStream } from '@/lexer'
import { Declaration } from '@/model'
import { ErrorReporter } from '@/tools/diagnostics'
import { HighlightRecorder } from '@/tools/highlights'
import * as cir from '@clawr/cir'

export type Context = {
    errorReporter: ErrorReporter
    highlightRecorder?: HighlightRecorder
    type?: string
    isolationLevel?: (cir.Expression & { kind: 'ALLOCATION' })['isolationLevel']
}

export { ModuleParser } from './module-parser'

export interface DeclarationParser<Decl extends Declaration> {
    isNext(stream: TokenStream): boolean
    parse(stream: TokenStream): Decl
}
