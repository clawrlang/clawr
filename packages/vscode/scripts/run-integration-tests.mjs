import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron'
import { existsSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'

// VS Code's own startup logging (bundled extensions, proposed-API diffing,
// telemetry/account plumbing, etc.) is noisy and unrelated to our tests, so
// filter it out before forwarding to the real stdout/stderr.
const dropLinePatterns = [
    /^\[main /,
    /^\[ChatModelSelection\]/,
    /^\[RemoteAgentHost\]/,
    /^\[AgentHost/,
    /^\[CloudSandboxApi\]/,
    /^\[AccountPolicyGate\]/,
    /^Settings Sync:/,
    /^Loading development extension/,
    /^Proceeding with EXTRA/,
    /DeprecationWarning/,
    /\(Use `Code Helper/,
]

function createFilteredStream(target) {
    let buffer = ''
    let suppressingProposals = false

    function handleLine(line) {
        if (/^Extension '.*' appears in product\.json/.test(line)) {
            suppressingProposals = true
            return
        }
        if (suppressingProposals) {
            if (/^DELTA:/.test(line)) suppressingProposals = false
            return
        }
        if (dropLinePatterns.some((pattern) => pattern.test(line))) return
        target.write(`${line}\n`)
    }

    return new Writable({
        write(chunk, _encoding, callback) {
            buffer += chunk.toString()
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) handleLine(line)
            callback()
        },
        final(callback) {
            if (buffer) handleLine(buffer)
            callback()
        },
    })
}

const vscodeExecutablePath = await downloadAndUnzipVSCode({
    version: 'stable',
})

if (process.platform === 'darwin' && !existsSync(vscodeExecutablePath)) {
    const codePath = join(dirname(vscodeExecutablePath), 'Code')
    if (existsSync(codePath)) {
        try {
            symlinkSync('Code', vscodeExecutablePath)
        } catch (error) {
            if (error.code !== 'EEXIST') throw error
        }
    }
}

if (!existsSync(vscodeExecutablePath))
    throw new Error(
        `VS Code test executable not found: ${vscodeExecutablePath}`,
    )

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

try {
    await runTests({
        vscodeExecutablePath,
        extensionDevelopmentPath: packageRoot,
        extensionTestsPath: join(
            packageRoot,
            'dist-tests/integration/runner.js',
        ),
        stdout: createFilteredStream(process.stdout),
        stderr: createFilteredStream(process.stderr),
        // Keep output limited to our own test results: other built-in
        // extensions (e.g. Copilot Chat) otherwise log a lot of noise.
        launchArgs: [
            join(packageRoot, 'tests/integration/fixtures'),
            '--disable-extensions',
            '--disable-workspace-trust',
            '--skip-welcome',
            '--skip-release-notes',
            '--disable-telemetry',
        ],
    })
} catch (error) {
    console.error(error)
    process.exitCode = 1
}
