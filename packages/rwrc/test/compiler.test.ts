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
            const exePath = `${OUTPUT_DIR}/${fileName.replace(/.clawr$/, '')}`

            const compilerResult = await runCli(fileName)
            expect(compilerResult.stdout).toBe('')
            if (fs.existsSync(errFilePath)) {
                const data = fs.readFileSync(errFilePath, 'utf-8')
                expect(compilerResult).toMatchObject({
                    code: 1,
                    stderr: data,
                })
                return
            } else {
                expect(compilerResult).toMatchObject({
                    code: 0,
                    stderr: '',
                })
            }

            const panicFilePath = `${CASES_DIR}/${fileName.replace(/.clawr$/, '.panic')}`
            const exeResult = await exec(exePath, [])
            if (fs.existsSync(panicFilePath)) {
                // The program must abort with the expected message after printing its output
                expect(exeResult.code).not.toBe(0)
                expect(exeResult.stderr).toBe(
                    fs.readFileSync(panicFilePath, 'utf-8'),
                )
                if (fs.existsSync(outFilePath))
                    expect(exeResult.stdout).toBe(
                        fs.readFileSync(outFilePath, 'utf-8'),
                    )
                return
            }
            expect(exeResult).toMatchObject({
                code: 0,
                stderr: '',
            })
            if (fs.existsSync(outFilePath)) {
                const data = fs.readFileSync(outFilePath, 'utf-8')
                expect(exeResult.stdout).toBe(data)
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
