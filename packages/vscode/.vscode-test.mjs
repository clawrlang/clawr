import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
    label: 'integrationTests',
    files: 'dist-tests/integration/**/*.test.js',
    workspaceFolder: './tests/integration/fixtures',
    mocha: {
        timeout: 20000,
    },
})
