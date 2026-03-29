#!/usr/bin/env node

import fs from 'fs'
import { Command } from 'commander'
import { TokenStream } from '../lexer'
import { Parser } from '../parser/Parser'
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
            const source = await fs.promises.readFile(sourceFile, 'utf-8')
            const tokenStream = new TokenStream(source, sourceFile)
            const ast = new Parser(tokenStream).parse()
            const ir = new IRGenerator().generate(ast)
            const cCode = codegenC(ir)
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
