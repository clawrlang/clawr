import path from 'node:path'
import child_process from 'node:child_process'
import { describe, expect, it } from 'bun:test'

const FIXTURE = path.join(__dirname, 'cases', 'rwrc-test-fixture')

describe('rwrc test command', () => {
    it('runs all @Test functions under a directory', async () => {
        const result = await exec('./dist/rwrc', ['test', FIXTURE])
        expect(result).toMatchObject({
            code: 0,
            stderr: '',
            stdout: '',
        })
    })
})

async function exec(command: string, args: string[]) {
    return await new Promise<{
        code: number
        stderr: string
        stdout: string
    }>((resolve) => {
        const proc = child_process.spawn(command, args, {
            cwd: path.join(__dirname, '..', '..'),
        })

        let stdout = ''
        let stderr = ''

        proc.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        proc.stderr?.on('data', (data) => {
            stderr += data.toString()
        })

        proc.on('close', (code) => {
            resolve({
                code: code ?? -1,
                stderr,
                stdout,
            })
        })
    })
}
