import type { ModuleGraph } from './module-graph'
import type { ASTProgram, ASTStatement } from '../ast'
import path from 'node:path'

export function composeEntryProgram(graph: ModuleGraph): ASTProgram {
    const entry = graph.modules.get(graph.entry)
    if (!entry) throw new Error('Entry module missing from module graph')

    const mergedDeclarations: ASTStatement[] = []

    for (const modulePath of graph.order) {
        const program = graph.modules.get(modulePath)
        if (!program)
            throw new Error(`Module missing from graph: ${modulePath}`)

        const declarationStatements = program.body.filter((stmt) => {
            if (!isDeclaration(stmt)) return false
            if (modulePath === graph.entry) return true
            return stmt.visibility === 'public'
        })
        mergedDeclarations.push(...declarationStatements)

        // Only entry module may define executable top-level statements.
        if (modulePath !== graph.entry) {
            const executableStatements = program.body.filter(isExecutable)
            if (executableStatements.length > 0) {
                throw new Error(
                    `${path.relative(process.cwd(), modulePath)} has top-level executable statements; only declarations are allowed in imported modules`,
                )
            }
        }
    }

    const entryExecutableStatements = entry.body.filter(isExecutable)

    return {
        imports: entry.imports.map((imp) => ({
            ...imp,
            items: imp.items.map((item) => ({ ...item })),
        })),
        body: [...mergedDeclarations, ...entryExecutableStatements],
    }

    function isExecutable(stmt: ASTStatement): boolean {
        return !isDeclaration(stmt)
    }

    function isDeclaration(stmt: ASTStatement) {
        return (
            stmt.kind === 'data-decl' ||
            stmt.kind === 'func-decl' ||
            stmt.kind === 'object-decl' ||
            stmt.kind === 'service-decl'
        )
    }
}
