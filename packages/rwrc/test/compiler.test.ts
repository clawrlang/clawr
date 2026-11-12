import { describe, expect, test } from 'bun:test'
import fs from 'fs'
import child_process from 'node:child_process'
import path from 'path'

const CASES_DIR = path.join(__dirname, 'cases')
const OUTPUT_DIR = path.join(__dirname, '.out')
const RWRC_PATH = path.resolve(__dirname, '../dist/rwrc')

describe('End-to-end Tests', () => {
    const cases = fs
        .readdirSync(CASES_DIR, { withFileTypes: true })
        .map((f) => f.name)
        .filter((n) => n.endsWith('.clawr'))

    for (const fileName of cases) {
        test(fileName, async () => {
            const outFilePath = `${CASES_DIR}/${fileName.replace(/.clawr$/, '.out')}`
            const errFilePath = `${CASES_DIR}/${fileName.replace(/.clawr$/, '.err')}`
            const panicFilePath = `${CASES_DIR}/${fileName.replace(/.clawr$/, '.panic')}`
            const exePath = `${OUTPUT_DIR}/${fileName.replace(/.clawr$/, '')}`

            const errFileExists = fs.existsSync(errFilePath)

            const compilerResult = await runCli(fileName)
            checkCompilerOutput(compilerResult)
            if (errFileExists) return

            const exeResult = await exec(exePath, [])
            checkForPanicCondition(exeResult)
            checkStdOut(exeResult)

            function checkCompilerOutput(result: ExecResult) {
                const expectedExitCode = errFileExists ? 1 : 0
                const expectedError = errFileExists
                    ? fs.readFileSync(errFilePath, 'utf-8')
                    : ''
                expect(result).toMatchObject({
                    code: expectedExitCode,
                    stderr: expectedError,
                    stdout: '',
                })
            }

            function checkForPanicCondition(result: ExecResult) {
                const panicFileExists = fs.existsSync(panicFilePath)
                const expectedOutput = panicFileExists
                    ? fs.readFileSync(panicFilePath, 'utf-8')
                    : ''
                const expectedExitCode = panicFileExists ? 1 : 0
                expect(result).toMatchObject({
                    code: expectedExitCode,
                    stderr: expectedOutput,
                })
            }

            function checkStdOut(result: ExecResult) {
                if (!fs.existsSync(outFilePath)) return
                const expectedOutput = fs.readFileSync(outFilePath, 'utf-8')
                expect(result.stdout).toBe(expectedOutput)
            }
        })
    }
})

describe('multi-file builds', () => {
    const directory = path.join(__dirname, 'multifile')

    for (const files of [
        ['main.clawr', 'helper.clawr'],
        ['helper.clawr', 'main.clawr'],
        ['types-main.clawr', 'types-helper.clawr'],
        ['types-helper.clawr', 'types-main.clawr'],
        ['global-main.clawr', 'global-helper.clawr'],
        ['global-helper.clawr', 'global-main.clawr'],
        ['object-main.clawr', 'object-helper.clawr'],
        ['object-helper.clawr', 'object-main.clawr'],
        ['method-main.clawr', 'method-helper.clawr'],
        ['method-helper.clawr', 'method-main.clawr'],
        ['fields-main.clawr', 'fields-helper.clawr'],
        ['fields-helper.clawr', 'fields-main.clawr'],
    ]) {
        test(`compiles ${files.join(', ')}`, async () => {
            const result = await exec(
                RWRC_PATH,
                ['build', ...files, '--name', 'multi', '-o', OUTPUT_DIR],
                directory,
            )
            expect(result).toMatchObject({ code: 0, stdout: '', stderr: '' })
            expect(
                await exec(path.join(OUTPUT_DIR, 'multi'), []),
            ).toMatchObject({
                code: 0,
                stdout: '42\n',
                stderr: '',
            })
        })
    }

    test('requires a name for multiple files', async () => {
        const result = await exec(
            RWRC_PATH,
            ['build', 'main.clawr', 'helper.clawr', '-o', OUTPUT_DIR],
            directory,
        )
        expect(result.code).toBe(1)
        expect(result.stderr).toContain('output name is required')
    })

    test('requires an entry point for a single file', async () => {
        const result = await exec(
            RWRC_PATH,
            ['build', 'helper.clawr', '-o', OUTPUT_DIR],
            directory,
        )
        expect(result.code).toBe(1)
        expect(result.stderr).toContain('No @main block found')
    })

    test('reports a duplicate entry point in the second file', async () => {
        const result = await exec(
            RWRC_PATH,
            [
                'build',
                'main.clawr',
                'another-main.clawr',
                '-n',
                'multi',
                '-o',
                OUTPUT_DIR,
            ],
            directory,
        )
        expect(result.code).toBe(1)
        expect(result.stderr).toContain(
            'another-main.clawr:1:1-6:Multiple @main blocks',
        )
    })

    test('reports semantic errors in the file that contains them', async () => {
        const result = await exec(
            RWRC_PATH,
            [
                'build',
                'main.clawr',
                'helper.clawr',
                'broken.clawr',
                '-n',
                'multi',
                '-o',
                OUTPUT_DIR,
            ],
            directory,
        )
        expect(result.code).toBe(1)
        expect(result.stderr).toContain('broken.clawr:1:')
        expect(result.stderr).toContain('missing')
    })

    test('rejects duplicate declarations and duplicate source paths', async () => {
        const duplicate = await exec(
            RWRC_PATH,
            [
                'build',
                'main.clawr',
                'duplicate.clawr',
                '-n',
                'multi',
                '-o',
                OUTPUT_DIR,
            ],
            directory,
        )
        expect(duplicate.code).toBe(1)
        expect(duplicate.stderr).toContain('duplicate.clawr:1:')
        expect(duplicate.stderr).toContain('Duplicate declaration')
        const source = await exec(
            RWRC_PATH,
            [
                'build',
                'main.clawr',
                './main.clawr',
                '-n',
                'multi',
                '-o',
                OUTPUT_DIR,
            ],
            directory,
        )
        expect(source.code).toBe(1)
        expect(source.stderr).toContain('Duplicate source file')
    })
})

async function runCli(fileName: string) {
    // Relative paths keep diagnostics (and `.err` files) machine independent
    return await exec(
        RWRC_PATH,
        ['build', fileName, '-o', OUTPUT_DIR],
        CASES_DIR,
    )
}

async function exec(command: string, args: string[], cwd?: string) {
    return await new Promise<ExecResult>((resolve) => {
        const proc = child_process.spawn(command, args, { cwd })

        let stdout = ''
        let stderr = ''

        proc.stdout!!.on('data', (data) => {
            stdout += data.toString()
        })

        proc.stderr!!.on('data', (data) => {
            stderr += data.toString()
        })

        proc.on('close', (x) => {
            resolve({
                code: x ?? -1,
                stderr,
                stdout,
            })
        })
    })
}

type ExecResult = {
    code: number
    stdout: string
    stderr: string
}
