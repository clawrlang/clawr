import fs from 'fs'
import path from 'path'
import child_process from 'node:child_process'
import { describe, expect, test } from 'bun:test'
import * as backend from '@/backend'

const CASES_DIR = path.join(__dirname, 'cases')
const OUTPUT_DIR = path.join(__dirname, '.out')

describe('Lowering Tests', () => {
    const distDir = path.resolve(process.cwd(), 'dist')
    const cases = fs
        .readdirSync(CASES_DIR, { withFileTypes: true })
        .map((f) => f.name)
        .filter((n) => n.endsWith('.cir'))

    for (const fileName of cases) {
        test(fileName, async () => {
            const outFilePath = path.join(
                CASES_DIR,
                fileName.replace(/.cir$/, '.out'),
            )
            const errFilePath = path.join(
                CASES_DIR,
                fileName.replace(/.cir$/, '.err'),
            )
            const exePath = path.join(OUTPUT_DIR, fileName.replace(/.cir$/, ''))

            await lower(fileName)
            const compilerResult = await exec('clang', [
                '-I',
                path.join(distDir, 'include'),
                path.join(OUTPUT_DIR, `${fileName.replace(/.cir$/, '.c')}`),
                path.join(distDir, 'libClawr.A.dylib'),
                '-o',
                exePath,
            ])
            expect(compilerResult.stdout).toBe('')
            if (fs.existsSync(errFilePath)) {
                const data = fs.readFileSync(errFilePath, 'utf-8')
                expect(compilerResult).toMatchObject({
                    code: 1,
                    stderr: data,
                })
            } else {
                expect(compilerResult).toMatchObject({
                    code: 0,
                    stderr: '',
                })
            }

            const exeResult = await exec(exePath, [])
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

async function lower(fileName: string) {
    const inputFilePath = path.join(CASES_DIR, fileName)
    const outputFilePath = path.join(
        OUTPUT_DIR,
        `${fileName.replace(/.cir$/, '')}.c`,
    )

    const cir = fs.readFileSync(inputFilePath, 'utf-8')
    const code = backend.lower(cir)
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true })
    await fs.promises.writeFile(outputFilePath, code)
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
