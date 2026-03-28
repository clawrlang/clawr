#!/usr/bin/env node

import { Command } from 'commander'

const cli = new Command()

cli.name('rwrc')
    .description('Clawr prototype compiler')
    .command('build')
    .argument('<sourceFile>', 'path to .clawr source file')
    .option('-o, --outdir <dir>', 'directory for output executable', '.')
    .action(async (sourceFile: string, options: { outdir: string }) => {
        console.log(
            `Building ${sourceFile} to ${options.outdir} `,
            '(not implemented yet)',
        )
    })

cli.parseAsync(process.argv)
