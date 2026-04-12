#!/usr/bin/env node

import fs from 'fs'
import os from 'node:os'
import { Command } from 'commander'
import {
    CompilerDiagnosticsError,
    SemanticAnalyzer,
} from '../semantic-analyzer'
import {
    buildModuleGraph,
    type ModuleGraph,
} from '../semantic-analyzer/module-graph'
import { IRGenerator } from '../ir/ir-generator'
import { codegenC } from '../codegen'
import child_process from 'node:child_process'
import path from 'node:path'
import { glob } from 'fast-glob'
import {
    discoverTestsInTree,
    formatDiscoverySkipWarning,
    generateHarnessSource,
} from './test-harness'
import { composeEntryProgram } from '../semantic-analyzer/module-composer'

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
            await compileClawrEntry(sourceFile, outFilePath)
        } catch (err) {
            if (err instanceof CompilerDiagnosticsError) {
                console.error(err.message)
            } else {
                console.error(`Error: ${(err as Error).message}`)
            }
            process.exit(1)
        }
    })

cli.command('test')
    .argument('<directory>', 'path to directory containing .clawr source files')
    .description(
        'Run all @Test-annotated void functions under the directory tree',
    )
    .action(async (directory: string) => {
        let workDir: string | undefined
        let exitCode = 0
        try {
            const testRoot = path.resolve(directory)
            if (!(await pathExists(testRoot))) {
                throw new Error(`No such directory: ${testRoot}`)
            }
            const stat = await fs.promises.stat(testRoot)
            if (!stat.isDirectory()) {
                throw new Error(`Not a directory: ${testRoot}`)
            }

            const { tests, skipped } = await discoverTestsInTree(testRoot)
            for (const s of skipped) {
                console.error(formatDiscoverySkipWarning(s))
            }

            if (tests.length === 0) {
                console.error('rwrc test: no runnable @Test functions found')
            } else {
                workDir = await fs.promises.mkdtemp(
                    path.join(os.tmpdir(), 'clawr-test-'),
                )
                const harnessPath = path.join(workDir, 'entry.clawr')
                const outFilePath = path.join(workDir, 'runner')

                await fs.promises.writeFile(
                    harnessPath,
                    generateHarnessSource(harnessPath, tests),
                    'utf-8',
                )

                await compileClawrEntry(harnessPath, outFilePath)

                const run = await exec(outFilePath, [])
                if (run.stdout) process.stdout.write(run.stdout)
                if (run.stderr) process.stderr.write(run.stderr)
                exitCode = run.code
            }
        } catch (err) {
            exitCode = 1
            if (err instanceof CompilerDiagnosticsError) {
                console.error(err.message)
            } else {
                console.error(`Error: ${(err as Error).message}`)
            }
        } finally {
            if (workDir) {
                await fs.promises.rm(workDir, { recursive: true, force: true })
            }
        }
        process.exit(exitCode)
    })

cli.parseAsync(process.argv)

async function pathExists(p: string): Promise<boolean> {
    try {
        await fs.promises.access(p)
        return true
    } catch {
        return false
    }
}

async function compileClawrEntry(
    sourceFile: string,
    outFilePath: string,
): Promise<void> {
    const graph = await buildModuleGraph(sourceFile)
    const ast = graph.modules.get(graph.entry)
    if (!ast) throw new Error('Entry module missing from module graph')

    const compositeProgram = composeEntryProgram(graph)
    const semanticModule = new SemanticAnalyzer(compositeProgram).analyze()
    const program = new IRGenerator().generate(semanticModule)
    const cCode = codegenC(program)
    await fs.promises.writeFile(outFilePath + '.c', cCode)

    await compileCCode(
        outFilePath + '.c',
        outFilePath,
        resolveRuntimeDirectory(),
    )
}

function resolveRuntimeDirectory(): string {
    return process.execPath.endsWith('rwrc')
        ? path.resolve(path.dirname(process.execPath), 'runtime')
        : path.join(__dirname, '..', 'runtime')
}

async function compileCCode(
    sourceFile: string,
    outFilePath: string,
    runtimeDir: string,
) {
    const runtimeSources = await glob(path.join(runtimeDir, '*.c'))
    const result = await exec('clang', [
        '-I',
        path.join(runtimeDir, 'include'),
        sourceFile,
        ...runtimeSources,
        '-o',
        outFilePath,
    ])

    if (result.code !== 0) {
        const errorMessage =
            result.stderr || `clang failed with exit code ${result.code}`
        throw new Error(errorMessage)
    }
}

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
