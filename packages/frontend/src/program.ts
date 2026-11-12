import { TokenStream } from '@/lexer'
import { Module } from '@/model/module'
import { DataDeclaration } from '@/model/data-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { InterfaceDeclaration } from '@/model/interface-declaration'
import { ObjectDeclaration } from '@/model/object-declaration'
import { TypeAliasDeclaration } from '@/model/type-alias-declaration'
import { VariableDeclaration } from '@/model/variable-declaration'
import { Scope } from '@/model/scope'
import { ModuleParser } from '@/parser/module-parser'
import { SourceError } from '@/tools'
import { HighlightRecorder } from '@/tools/highlights'
import { DefinitionRecorder } from '@/tools/definitions'

export type ProgramSource = {
    name: string
    source: string
}

export function parseProgram(
    sources: readonly ProgramSource[],
    scope: Scope,
    requireMain = true,
    recorders?: {
        highlightRecorder?: HighlightRecorder
        definitionRecorder?: DefinitionRecorder
    },
): Module {
    const names = new Set<string>()
    const modules: Module[] = []
    const declarations = new Set<string>()
    let main: Module | undefined

    for (const { name, source } of sources) {
        if (names.has(name)) throw new Error(`Duplicate source file: ${name}`)
        names.add(name)
        const module = ModuleParser.create({ scope, ...recorders }).parse(
            TokenStream.read(source, name),
        )
        for (const declaration of module.declarations) {
            const entry =
                declaration instanceof FunctionDeclaration
                    ? {
                          key: `function:${declaration.name()}`,
                          span: declaration.span,
                      }
                    : declaration instanceof ObjectDeclaration ||
                        declaration instanceof InterfaceDeclaration ||
                        declaration instanceof DataDeclaration
                      ? {
                            key: `type:${declaration.name.canonical()}`,
                            span: declaration.span,
                        }
                      : declaration instanceof TypeAliasDeclaration
                        ? {
                              key: `type:${declaration.name}`,
                              span: declaration.value.span,
                          }
                        : declaration instanceof VariableDeclaration
                          ? {
                                key: `variable:${declaration.name}`,
                                span: declaration.span,
                            }
                          : undefined
            if (!entry) continue
            if (declarations.has(entry.key))
                throw SourceError.create({
                    message: `Duplicate declaration: ${entry.key.substring(entry.key.indexOf(':') + 1)}`,
                    span: entry.span ?? {
                        start: { line: 1, column: 1, source: name },
                        end: { line: 1, column: 1, source: name },
                    },
                })
            declarations.add(entry.key)
        }
        if (module.main !== undefined) {
            if (main)
                throw SourceError.create({
                    message: 'Multiple @main blocks found',
                    span: module.mainSpan!,
                })
            main = module
        }
        modules.push(module)
    }

    if (requireMain && !main) throw new Error('No @main block found')

    return Module.create({
        declarations: modules.flatMap((module) => module.declarations),
        main: main?.main,
        mainSpan: main?.mainSpan,
    })
}
