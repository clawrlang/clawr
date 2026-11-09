import { readFileSync } from 'node:fs'
import { TokenStream } from '@/lexer'
import { Scope } from '@/model/scope'
import { ModuleParser } from '@/parser/module-parser'

export function createStandardLibraryScope(): Scope {
    const scope = Scope.createRoot(undefined, 'clawr')
    const sourcePath = require.resolve('@clawr/stdlib/stdlib.clawr')
    const source = readFileSync(sourcePath, 'utf8')
    const module = ModuleParser.create({ scope }).parse(
        TokenStream.read(source),
    )
    module.toCIR({ scope })
    return scope
}
