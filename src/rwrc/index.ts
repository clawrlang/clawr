#!/usr/bin/env node

import fs from 'fs'
import { Command } from 'commander'
import type { ASTDataDeclaration, ASTProgram, ASTStatement } from '../ast'
import { SemanticAnalyzer } from '../semantic-analyzer'
import {
    buildModuleGraph,
    type ModuleGraph,
} from '../semantic-analyzer/module-graph'
import { IRGenerator } from '../ir/ir-generator'
import { codegenC } from '../codegen'
import child_process from 'node:child_process'
import path from 'node:path'
import { glob } from 'fast-glob'

const cli = new Command()

cli.name('rwrc')
    .description('Clawr prototype compiler')
    .command('build')
    .argument('<sourceFile>', 'path to .clawr source file')
    .option('-o, --outdir <dir>', 'directory for output executable', '.')
    .action(async (sourceFile: string, options: { outdir: string }) => {
        try {
            const basename = path.basename(sourceFile, '.clawr')
            const outFilePath = path.resolve(options.outdir, basename)
            const graph = await buildModuleGraph(sourceFile)
            const ast = graph.modules.get(graph.entry)
            if (!ast) {
                throw new Error('Entry module missing from module graph')
            }
            const compositeProgram = composeEntryProgram(graph)
            const semanticModule = new SemanticAnalyzer(
                compositeProgram,
            ).analyze()
            const program = new IRGenerator().generate(semanticModule)
            const cCode = codegenC(program)
            await fs.promises.writeFile(outFilePath + '.c', cCode)

            // Compile the generated C code using clang
            const runtimeDir = path.resolve(process.cwd(), 'src/runtime')
            const runtimeSources = await glob(path.join(runtimeDir, '*.c'))
            const result = await exec('clang', [
                '-I',
                path.join(runtimeDir, 'include'),
                outFilePath + '.c',
                ...runtimeSources,
                '-o',
                outFilePath,
            ])

            if (result.code !== 0) {
                const errorMessage =
                    result.stderr ||
                    `clang failed with exit code ${result.code}`
                throw new Error(errorMessage)
            }
        } catch (err) {
            console.error(`Error: ${(err as Error).message}`)
            process.exit(1)
        }
    })

cli.parseAsync(process.argv)

async function exec(command: string, args: string[]) {
    return await new Promise<ExecResult>((resolve) => {
        const proc = child_process.spawn(command, args)

        let stdout = ''
        let stderr = ''

        proc.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        proc.stderr?.on('data', (data) => {
            stderr += data.toString()
        })

        proc.on('close', (code) => {
            resolve({
                code: code ?? -1,
                stdout,
                stderr,
            })
        })
    })
}

type ExecResult = {
    code: number
    stdout: string
    stderr: string
}

function composeEntryProgram(graph: ModuleGraph): ASTProgram {
    const entry = graph.modules.get(graph.entry)
    if (!entry) {
        throw new Error('Entry module missing from module graph')
    }

    const mergedDeclarations: ASTDataDeclaration[] = []

    for (const modulePath of graph.order) {
        const program = graph.modules.get(modulePath)
        if (!program) {
            throw new Error(`Module missing from graph: ${modulePath}`)
        }

        const dataDeclarations = program.body.filter(
            (stmt): stmt is ASTDataDeclaration => stmt.kind === 'data-decl',
        )
        mergedDeclarations.push(...dataDeclarations)

        // Keep execution semantics explicit for this slice: only entry module may
        // define executable top-level statements.
        if (modulePath !== graph.entry) {
            const executableStatements = program.body.filter(
                (stmt): stmt is ASTStatement => stmt.kind !== 'data-decl',
            )
            if (executableStatements.length > 0) {
                throw new Error(
                    `${path.relative(process.cwd(), modulePath)} has top-level executable statements; only data declarations are allowed in imported modules for now`,
                )
            }
        }
    }

    const entryExecutableStatements = entry.body.filter(
        (stmt): stmt is ASTStatement => stmt.kind !== 'data-decl',
    )

    return {
        imports: entry.imports.map((imp) => ({
            ...imp,
            items: imp.items.map((item) => ({ ...item })),
        })),
        body: [...mergedDeclarations, ...entryExecutableStatements],
    }
}
