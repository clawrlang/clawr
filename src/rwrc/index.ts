#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import Bun from 'bun'
import { Command } from 'commander'

import * as backend from '../backend'
import { ModuleParser } from '../parser'
import { TokenStream } from '../lexer'
import { ClawrModule } from '../cir'
import { ErrorReporter } from './error-reporter'
import { Scope } from '../model/scope'
import typia from 'typia'

const exeDir = path.dirname(process.execPath)
const program = new Command()

program.name('rwrc').description('Clawr language compiler').version('0.1.0')

program
    .command('build <file>')
    .option('-o, --outdir <dir>', 'Output directory', 'dist')
    .description('Compile a Clawr source file')
    .action(async (file: string, options: { outdir: string }) => {
        const resolvedOutDir = path.resolve(options.outdir)
        const outputFilePath = `${resolvedOutDir}/${path.basename(file).replace(/\.[^/.]+$/, '.cir')}`

        try {
            await parseToCIR({ file, outputFilePath })
            await compileCIR(outputFilePath)
        } catch (err) {
            console.error(err instanceof Error ? err.message : err)
            process.exit(1)
        }
    })

program.parse(process.argv)

async function parseToCIR({
    file,
    outputFilePath,
}: {
    file: string
    outputFilePath: string
}) {
    const context = {
        errorReporter: new ErrorReporter(file),
        scope: Scope.createRoot(),
    }

    const sourceCode = await fs.readFile(file, 'utf-8')
    const stream = TokenStream.read(sourceCode, context.errorReporter)
    const cir = ModuleParser.create(context).parse(stream).toCIR(context)

    await ensureDirectoryExists(path.dirname(outputFilePath))
    await fs.writeFile(outputFilePath, JSON.stringify(cir))
}

async function compileCIR(cirFilePath: string) {
    const exePath = `${cirFilePath.replace(/\.[^/.]+$/, '')}`
    const cFilePath = `${exePath}.c`

    const cir = JSON.parse(
        await fs.readFile(cirFilePath, 'utf-8'),
    ) as ClawrModule
    await validateCIR(cir)
    const cCode = backend.lower(cir)

    await fs.writeFile(cFilePath, cCode)

    const proc = Bun.spawn(
        [
            'clang',
            '-I',
            path.join(exeDir, 'include'),
            cFilePath,
            path.join(exeDir, 'libClawr.A.dylib'),
            '-o',
            exePath,
        ],
        {
            stdout: 'inherit',
            stderr: 'inherit',
        },
    )
    await proc.exited
}

async function validateCIR(cir: ClawrModule) {
    const result = typia.validate<ClawrModule>(cir)
    if (!result.success) {
        const details = result.errors
            .map((error) => `${error.path} expected ${error.expected}`)
            .join('; ')
        throw new Error(`Invalid CIR: ${details}`)
    }
}

async function ensureDirectoryExists(outputDir: string) {
    if (!(await fs.stat(outputDir).catch(() => false))) {
        await fs.mkdir(outputDir, { recursive: true })
    }
}
