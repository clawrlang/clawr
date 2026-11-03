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
