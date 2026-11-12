#!/usr/bin/env node

import Bun from 'bun'
import { Command } from 'commander'
import { readFileSync } from 'fs'
import fs from 'fs/promises'
import path from 'path'

import * as backend from '@clawr/backend'
import { Scope } from '@clawr/frontend/model/scope'
import { parseProgram } from '@clawr/frontend/program'
import { createStandardLibraryScope } from '@clawr/frontend/stdlib'
import {
    SourceCodeSpan,
    SourceError,
    SourceErrorCollection,
} from '@clawr/frontend/tools'

const exeDir = path.dirname(process.execPath)
const runtimeLibName = readFileSync(
    path.join(exeDir, 'libClawr.name'),
    'utf-8',
).trim()
const program = new Command()

program.name('rwrc').description('Clawr language compiler').version('0.1.0')

program
    .command('build <files...>')
    .option('-o, --outdir <dir>', 'Output directory', 'dist')
    .option('-n, --name <name>', 'Output name (required for multiple files)')
    .description('Compile Clawr source files in the given order')
    .action(
        async (files: string[], options: { outdir: string; name?: string }) => {
            try {
                if (files.length > 1 && !options.name)
                    throw new Error(
                        'An output name is required for multiple source files',
                    )
                if (
                    options.name &&
                    (path.basename(options.name) !== options.name ||
                        options.name === '.' ||
                        options.name === '..')
                )
                    throw new Error(
                        'Output name must be a filename, not a path',
                    )
                const name =
                    options.name ??
                    path.basename(files[0]).replace(/\.[^/.]+$/, '')
                const outputFilePath = path.join(
                    path.resolve(options.outdir),
                    `${name}.cir`,
                )
                await parseToCIR({ files, outputFilePath })
                await compileCIR(outputFilePath)
            } catch (err) {
                const errors =
                    err instanceof SourceErrorCollection
                        ? err.errors
                        : err instanceof SourceError
                          ? [err]
                          : undefined
                if (errors)
                    for (const e of errors)
                        console.error(
                            `${e.span.start.source ?? files[0]}:${spanString(e.span)}:${e.message}`,
                        )
                else console.error(err instanceof Error ? err.message : err)
                process.exit(1)
            }
        },
    )

program.parse(process.argv)

async function parseToCIR({
    files,
    outputFilePath,
}: {
    files: string[]
    outputFilePath: string
}) {
    const standardLibraryScope = createStandardLibraryScope()
    const context = {
        scope: Scope.createRoot(standardLibraryScope),
    }

    const resolved = files.map((file) => path.resolve(file))
    if (new Set(resolved).size !== resolved.length)
        throw new Error('Duplicate source file')
    const sources = await Promise.all(
        files.map(async (name) => ({
            name,
            source: await fs.readFile(name, 'utf-8'),
        })),
    )
    const cir = parseProgram(sources, context.scope).toCIR(context)

    await ensureDirectoryExists(path.dirname(outputFilePath))
    await fs.writeFile(outputFilePath, JSON.stringify(cir))
}

async function compileCIR(cirFilePath: string) {
    const exePath = `${cirFilePath.replace(/\.[^/.]+$/, '')}`
    const cFilePath = `${exePath}.c`
    const cCode = backend.lower(await fs.readFile(cirFilePath, 'utf-8'))

    await fs.writeFile(cFilePath, cCode)

    const proc = Bun.spawn(
        [
            'clang',
            '-I',
            path.join(exeDir, 'include'),
            cFilePath,
            path.join(exeDir, runtimeLibName),
            `-Wl,-rpath,${exeDir}`,
            '-o',
            exePath,
        ],
        {
            stdout: 'inherit',
            stderr: 'inherit',
        },
    )
    const exitCode = await proc.exited
    if (exitCode !== 0)
        throw new Error(`C compiler exited with status ${exitCode}`)
}

async function ensureDirectoryExists(outputDir: string) {
    if (!(await fs.stat(outputDir).catch(() => false))) {
        await fs.mkdir(outputDir, { recursive: true })
    }
}

function spanString({ start, end }: SourceCodeSpan) {
    return start.line === end.line
        ? `${start.line}:${start.column}-${end.column}`
        : `${start.line}:${start.column}-${end.line}:${end.column}`
}
