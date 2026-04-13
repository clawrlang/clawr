import fs from 'fs'
import path from 'path'
import child_process from 'node:child_process'
import { describe, expect, it, test } from 'bun:test'
import { NewFilePath } from '../../src/filesystem'

const CASES_DIR = NewFilePath.resolve(__dirname, 'cases')
const OUTPUT_DIR = NewFilePath.resolve(__dirname, 'out')

describe('End-to-end Tests', () => {
    const cases = fs
        .readdirSync(CASES_DIR.absolutePath, { withFileTypes: true })
        .map((f) => f.name)
        .filter((n) => n.endsWith('.clawr'))
    for (const fileName of cases) {
        test(fileName, async () => {
            if (!fs.existsSync(OUTPUT_DIR.absolutePath))
                fs.mkdirSync(OUTPUT_DIR.absolutePath)

            const filePath = CASES_DIR.subpath(fileName)
            const outFilePath = CASES_DIR.subpath(
                fileName.replace(/.clawr$/, '.out'),
            )
            const errFilePath = CASES_DIR.subpath(
                fileName.replace(/.clawr$/, '.err'),
            )
            const exePath = OUTPUT_DIR.subpath(fileName.replace(/.clawr$/, ''))

            const compilerResult = await runCli(filePath)
            expect(compilerResult.stdout).toBe('')
            if (fs.existsSync(errFilePath.absolutePath)) {
                const data = fs.readFileSync(errFilePath.absolutePath, 'utf-8')
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

            const exeResult = await exec(exePath.absolutePath, [])
            expect(exeResult).toMatchObject({
                code: 0,
                stderr: '',
            })
            if (fs.existsSync(outFilePath.absolutePath)) {
                const data = fs.readFileSync(outFilePath.absolutePath, 'utf-8')
                expect(exeResult.stdout).toBe(data)
            }
        })
    }
})

async function runCli(filePath: NewFilePath) {
    return await exec('./dist/rwrc', [
        'build',
        filePath.absolutePath,
        '-o',
        OUTPUT_DIR.absolutePath,
    ])
}

async function exec(command: string, args: string[]) {
    return await new Promise<ExecResult>((resolve) => {
        const proc = child_process.spawn(command, args)

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
