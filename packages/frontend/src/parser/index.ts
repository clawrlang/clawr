import { TokenStream } from '@/lexer'
import { Declaration } from '@/model'
import { HighlightRecorder } from '@/tools/highlights'
import { DefinitionRecorder } from '@/tools/definitions'
import type { Scope } from '@/model/scope'
import * as cir from '@clawr/cir'

export type Context = {
    highlightRecorder?: HighlightRecorder
    definitionRecorder?: DefinitionRecorder
    type?: string
    scope?: Scope
    isolationLevel?: (cir.Expression & { kind: 'ALLOCATION' })['isolationLevel']
}

export { ModuleParser } from '@/parser/module-parser'

export interface DeclarationParser<Decl extends Declaration> {
    isNext(stream: TokenStream): boolean
    parse(stream: TokenStream): Decl
}
