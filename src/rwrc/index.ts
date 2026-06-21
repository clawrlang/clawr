#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import { Command } from 'commander'
import Bun from 'bun'
import { ModuleParser } from '../parser'
import { TokenStream } from '../lexer'
import * as backend from '../backend'

const exeDir = path.dirname(process.execPath)
const program = new Command()

program.name('rwrc').description('Clawr language compiler').version('0.1.0')

program
    .command('build <file>')
    .option('-o, --outdir <dir>', 'Output directory', 'dist')
    .description('Compile a Clawr source file')
    .action(async (file: string, options: { outdir: string }) => {
        const resolvedOutDir = path.resolve(options.outdir)
        const cFilePath = `${resolvedOutDir}/${path.basename(file).replace(/.clawr$/, '.c')}`
        const exePath = `${resolvedOutDir}/${path.basename(file).replace(/.clawr$/, '')}`

        const sourceCode = await fs.readFile(file, 'utf-8')
        const stream = TokenStream.read(sourceCode, {
            reportFatalError(message, location) {
                console.error(
                    `Fatal Error: ${message} at ${location.start}-${location.end}`,
                )
                process.exit(1)
            },
            reportWarning(message, location) {
                console.warn(
                    `Warning: ${message} at ${location.start}-${location.end}`,
                )
            },
            reportError(message, location) {
                console.error(
                    `Error: ${message} at ${location.start}-${location.end}`,
                )
            },
        })
        const cir = ModuleParser.create(stream).parse()
        const cCode = backend.lower(cir)

        try {
            if (!(await fs.stat(resolvedOutDir).catch(() => false))) {
                await fs.mkdir(resolvedOutDir, { recursive: true })
            }
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
        } catch (err) {
            console.error(err instanceof Error ? err.message : err)
            // For debugging:
            // console.error('error:', err)
            process.exit(1)
        }
    })

program.parse(process.argv)
