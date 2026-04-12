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
        const result = await exec('./dist/rwrc', [
            'build',
            pkgDir,
            '--outdir',
            outDir,
        ])

        expect(result).toMatchObject({
            code: 0,
            stderr: '',
        })

        const output = execFileSync(binary, { encoding: 'utf-8' })
        expect(output).toContain('Hello from package!')
    })

    it('errors if non-main file has top-level statements', async () => {
        const badPkgDir = path.join(__dirname, 'packages', 'bad-top-level')
        const badOutDir = path.join(badPkgDir, 'out')
        if (!fs.existsSync(badOutDir)) fs.mkdirSync(badOutDir)
        const result = await exec('./dist/rwrc', [
            'build',
            badPkgDir,
            '--outdir',
            badOutDir,
        ])

        expect(result.code).toBe(1)
        expect(result.stderr).toMatch(
            /other\.clawr: Only main\.clawr may contain top-level executable statements/,
        )
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
