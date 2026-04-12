import { execFileSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import child_process from 'node:child_process'

describe('rwrc package mode', () => {
    const pkgDir = path.join(__dirname, 'packages', 'simple-package')
    const outDir = path.join(pkgDir, 'out')
    const binary = path.join(outDir, 'simple-package')

    beforeAll(() => {
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)
    })

    afterAll(() => {
        if (fs.existsSync(binary)) fs.unlinkSync(binary)
        if (fs.existsSync(binary + '.c')) fs.unlinkSync(binary + '.c')
        if (fs.existsSync(outDir)) fs.rmdirSync(outDir)
    })

    it('compiles and runs main.clawr in package mode', async () => {
        await exec('./dist/rwrc', ['build', pkgDir, '--outdir', outDir])

        const output = execFileSync(binary, { encoding: 'utf-8' })
        expect(output).toContain('Hello from package!')
    })
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
