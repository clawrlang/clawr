import * as assert from 'assert'
import * as vscode from 'vscode'
import { openFixture, waitFor } from './util'

suite('Diagnostics', () => {
    test('reports an error for an unknown variable', async () => {
        const document = await openFixture('broken.clawr')

        const diagnostics = await waitFor(() => {
            const found = vscode.languages.getDiagnostics(document.uri)
            return found.length > 0 ? found : undefined
        })

        assert.strictEqual(diagnostics.length, 1)
        assert.strictEqual(
            diagnostics[0].severity,
            vscode.DiagnosticSeverity.Error,
        )
        assert.ok(diagnostics[0].message.includes('unknownVar'))
    })

    test('reports no diagnostics for valid source', async () => {
        const document = await openFixture('valid.clawr')

        // Give the diagnostics provider a chance to run before asserting
        // there's nothing to find.
        await new Promise((resolve) => setTimeout(resolve, 200))

        const diagnostics = vscode.languages.getDiagnostics(document.uri)
        assert.strictEqual(diagnostics.length, 0)
    })
})
