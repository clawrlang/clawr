import { TokenStream } from '@/lexer'
import { Scope } from '@/model/scope'
import { ModuleParser } from '@/parser/module-parser'
import { readFileSync } from 'node:fs'

export function createStandardLibraryScope(): Scope {
    const scope = Scope.createRoot(undefined, 'clawr')
    const modules = [
        '@clawr/stdlib/subsets.clawr',
        '@clawr/stdlib/traits.clawr',
    ].map((x) => {
        const sourcePath = require.resolve(x)
        const source = readFileSync(sourcePath, 'utf8')
        return ModuleParser.create({ scope }).parse(TokenStream.read(source))
    })
    for (const module of modules) module.toCIR({ scope })
    return scope
}
