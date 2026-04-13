#!/usr/bin/env node

import fs from 'fs'
import { Command } from 'commander'
import {
    CompilerDiagnosticsError,
    SemanticAnalyzer,
} from '../semantic-analyzer'
import { findClawrFiles } from './package-discovery'
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
import { TokenStream } from '../lexer/stream'
import { Parser } from '../parser/index.js'
import { NewFilePath, RealFilePath } from '../filesystem'

const cli = new Command().name('rwrc').description('Clawr prototype compiler')

cli.command('build')
    .argument('<input>', 'path to .clawr source file or directory')
    .option('-o, --outdir <dir>', 'directory for output executable', '.')
    .action(async (input: string, options: { outdir: string }) => {
        try {
            const inputPath = RealFilePath.resolve(input)
            const outDirPath = RealFilePath.resolve(options.outdir)
            if (inputPath.isDirectory) {
                // Package mode: parse all .clawr files in the directory
                await compileClawrPackage(
                    inputPath,
                    outDirPath.newSubpath(inputPath.basename),
                )
            } else {
                // Script mode: single file
                await compileScript(
                    inputPath,
                    outDirPath.newSubpath(inputPath.basenameWithoutExtension),
                )
            }
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
        let workDir: RealFilePath | undefined
        let exitCode = 0
        try {
            const testRoot = RealFilePath.resolve(directory)
            if (!testRoot.isDirectory)
                throw new Error(`Not a directory: ${testRoot.absolutePath}`)

            const { tests, skipped } = await discoverTestsInTree(testRoot)
            for (const s of skipped) {
                console.error(formatDiscoverySkipWarning(s))
            }

            if (tests.length === 0) {
                console.error('rwrc test: no runnable @Test functions found')
            } else {
                workDir = await RealFilePath.createTemporary('clawr-test-')
                const outFilePath = workDir.newSubpath('runner')
                const harnessPath = await workDir.writeFile(
                    'entry.clawr',
                    generateHarnessSource(workDir, tests),
                )

                // Collect all .clawr files in the testRoot, add the harness as main
                const files = await findClawrFiles(testRoot)
                files.push(harnessPath)
                await compileClawrPackageWithMain(
                    files,
                    harnessPath,
                    outFilePath,
                )

                const run = await exec(outFilePath.absolutePath, [])
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
                await fs.promises.rm(workDir.absolutePath, {
                    recursive: true,
                    force: true,
                })
            }
        }
        process.exit(exitCode)
    })

cli.parseAsync(process.argv)

// Like compileClawrPackage, but with explicit file list and main file
async function compileClawrPackageWithMain(
    files: RealFilePath[],
    mainFile: RealFilePath,
    outFilePath: NewFilePath,
): Promise<void> {
    const { Parser } = await import('../parser/index.js')
    const { TokenStream } = await import('../lexer/index.js')
    const allAsts = []
    let mainAst = null
    for (const file of files) {
        const source = await file.readFile()
        const ast = new Parser(new TokenStream(source, file.basename)).parse()
        if (file.equals(mainFile)) {
            mainAst = ast
        }
        allAsts.push(ast)
    }
    if (!mainAst) {
        throw new Error(
            'Internal error: test harness AST not found after parsing.',
        )
    }
    // Merge all declarations from all files, and all executable statements from main
    const mergedBody = []
    for (const ast of allAsts) {
        if (ast === mainAst) continue
        mergedBody.push(
            ...ast.body.filter((stmt: any) =>
                [
                    'data-decl',
                    'func-decl',
                    'object-decl',
                    'service-decl',
                ].includes(stmt.kind),
            ),
        )
    }
    mergedBody.push(...mainAst.body)
    const mergedAst = {
        ...mainAst,
        body: mergedBody,
    }
    const semanticModule = new SemanticAnalyzer(mergedAst).analyze()
    const program = new IRGenerator().generate(semanticModule)
    const cCode = codegenC(program)
    const resolvedParent = RealFilePath.resolveNew(outFilePath.parent)
    const cFilePath = await resolvedParent.writeFile(
        `${outFilePath.basename}.c`,
        cCode,
    )
    await compileCCode(cFilePath, outFilePath)
}

async function compileScript(
    sourceFile: RealFilePath,
    outFilePath: NewFilePath,
): Promise<void> {
    // Script mode: parse and compile a single file
    const stream = new TokenStream(
        await sourceFile.readFile(),
        sourceFile.basename,
    )
    const program = new Parser(stream).parse()

    const semanticModule = new SemanticAnalyzer(program).analyze()
    const cIr = new IRGenerator().generate(semanticModule)
    const cCode = codegenC(cIr)
    const resolvedParent = RealFilePath.resolveNew(outFilePath.parent)
    const cFilePath = await resolvedParent.writeFile(
        `${outFilePath.basename}.c`,
        cCode,
    )
    await compileCCode(cFilePath, outFilePath)
}

async function compileClawrPackage(
    dir: RealFilePath,
    outFilePath: NewFilePath,
): Promise<void> {
    // Package mode: parse all .clawr files in the directory
    const files = await findClawrFiles(dir)
    if (files.length === 0) {
        throw new Error(
            `No .clawr files found in directory: ${dir.absolutePath}`,
        )
    }
    const mainFile = files.find((f) => f.basename === 'main.clawr')
    if (!mainFile) {
        throw new Error(
            `No main.clawr found in package directory: ${dir.absolutePath}`,
        )
    }

    // Parse all files and check for top-level executable statements
    const { Parser } = await import('../parser/index.js')
    const { TokenStream } = await import('../lexer/index.js')
    const allAsts = []
    let mainAst = null
    for (const file of files) {
        const source = await file.readFile()
        const ast = new Parser(new TokenStream(source, file.basename)).parse()
        if (file !== mainFile) {
            // Check for top-level executable statements (not declarations)
            const hasExecutable = ast.body.some(
                (stmt: any) =>
                    ![
                        'data-decl',
                        'func-decl',
                        'object-decl',
                        'service-decl',
                    ].includes(stmt.kind),
            )
            if (hasExecutable) {
                throw new Error(
                    `${path.relative(dir.absolutePath, file.absolutePath)}: Only main.clawr may contain top-level executable statements in a package`,
                )
            }
        } else {
            mainAst = ast
        }
        allAsts.push(ast)
    }

    if (!mainAst) {
        throw new Error(
            'Internal error: main.clawr AST not found after parsing.',
        )
    }

    // Merge all declarations from all files, and all executable statements from main.clawr
    const mergedBody = []
    for (const ast of allAsts) {
        if (ast === mainAst) continue
        mergedBody.push(
            ...ast.body.filter((stmt: any) =>
                [
                    'data-decl',
                    'func-decl',
                    'object-decl',
                    'service-decl',
                ].includes(stmt.kind),
            ),
        )
    }
    // Add main.clawr's declarations and executable statements
    mergedBody.push(...mainAst.body)
    // Compose a merged AST
    const mergedAst = {
        ...mainAst,
        body: mergedBody,
    }
    // Compile the merged AST
    const semanticModule = new SemanticAnalyzer(mergedAst).analyze()
    const program = new IRGenerator().generate(semanticModule)
    const cCode = codegenC(program)
    const resolvedParent = RealFilePath.resolveNew(outFilePath.parent)
    const cFilePath = await resolvedParent.writeFile(
        `${outFilePath.basename}.c`,
        cCode,
    )
    await compileCCode(cFilePath, outFilePath)
}

async function resolveRuntimeDirectory(): Promise<RealFilePath> {
    return process.execPath.endsWith('rwrc')
        ? RealFilePath.resolve(path.dirname(process.execPath), 'runtime')
        : RealFilePath.resolve(__dirname, '..', 'runtime')
}

async function compileCCode(
    sourceFile: RealFilePath,
    outFilePath: NewFilePath,
) {
    const runtimeDir = await resolveRuntimeDirectory()
    const runtimeSources = await glob(path.join(runtimeDir.absolutePath, '*.c'))
    const result = await exec('clang', [
        '-I',
        path.join(runtimeDir.absolutePath, 'include'),
        sourceFile.absolutePath,
        ...runtimeSources,
        '-o',
        outFilePath.absolutePath,
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
