import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

if (process.platform === 'darwin') {
    execFileSync(
        'codesign',
        [
            '--force',
            '--sign',
            '-',
            fileURLToPath(new URL('../dist/rwrc', import.meta.url)),
        ],
        { stdio: 'inherit' },
    )
}
