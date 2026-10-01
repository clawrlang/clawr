import { downloadAndUnzipVSCode } from '@vscode/test-electron'
import { spawnSync } from 'node:child_process'
import { existsSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const executablePath = await downloadAndUnzipVSCode({ version: 'stable' })

if (process.platform === 'darwin' && !existsSync(executablePath)) {
    const codePath = join(dirname(executablePath), 'Code')
    if (existsSync(codePath)) {
        try {
            symlinkSync('Code', executablePath)
        } catch (error) {
            if (error.code !== 'EEXIST') throw error
        }
    }
}

if (!existsSync(executablePath))
    throw new Error(`VS Code test executable not found: ${executablePath}`)

const require = createRequire(import.meta.url)
const testCliDirectory = dirname(require.resolve('@vscode/test-cli'))
const result = spawnSync(
    process.execPath,
    [join(testCliDirectory, 'bin.mjs')],
    { stdio: 'inherit' },
)

if (result.error) throw result.error
process.exitCode = result.status ?? 1
