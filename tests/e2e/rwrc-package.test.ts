import { execFileSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { afterAll, beforeAll, describe, expect, it, test } from 'bun:test'
import child_process from 'node:child_process'

const CASES_DIR = path.join(__dirname, 'packages')
const OUTPUT_DIR = path.join(CASES_DIR, 'out')

describe('rwrc package mode', () => {
    const pkgDir = path.join(CASES_DIR, 'simple-package')
    const binary = path.join(OUTPUT_DIR, 'simple-package')

    beforeAll(async () => {
        if (!fs.existsSync(OUTPUT_DIR)) await fs.promises.mkdir(OUTPUT_DIR)
    })

    afterAll(async () => {
        if (fs.existsSync(OUTPUT_DIR))
            await fs.promises.rm(OUTPUT_DIR, { recursive: true, force: true })
    })

    const cases = fs
        .readdirSync(CASES_DIR, { withFileTypes: true })
        .filter((n) => n.isDirectory())
    for (const d of cases) {
        test(d.name, async () => {
            const dir = path.join(CASES_DIR, d.name)
            const expectedErrFile = `${dir}.err`
            const expectedOutFile = `${dir}.out`

            const result = await exec('./dist/rwrc', [
                'build',
                dir,
                '--outdir',
                OUTPUT_DIR,
            ])

            if (fs.existsSync(expectedErrFile)) {
                const expectedErr = await fs.promises.readFile(
                    expectedErrFile,
                    'utf-8',
                )
                expect(result).toMatchObject({
                    code: 1,
                    stderr: expectedErr,
                })
                return
            }

            expect(result).toMatchObject({
                code: 0,
                stderr: '',
            })

            if (fs.existsSync(expectedOutFile)) {
                const expectedOut = await fs.promises.readFile(
                    expectedOutFile,
                    'utf-8',
                )
                const output = execFileSync(path.join(OUTPUT_DIR, d.name), {
                    encoding: 'utf-8',
                })
                expect(output).toBe(expectedOut)
            }
        })
    }
})

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
