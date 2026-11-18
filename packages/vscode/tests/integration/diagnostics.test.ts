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

        assert.ok(diagnostics.length >= 1)
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

    test('analyzes manifest-listed sources as the standard library', async () => {
        const document = await openFixture('stdlib-src/io.clawr')

        // The opaque service is only accepted in the stdlib's own
        // namespace; give the diagnostics provider a chance to run.
        await new Promise((resolve) => setTimeout(resolve, 200))

        const diagnostics = vscode.languages.getDiagnostics(document.uri)
        assert.strictEqual(diagnostics.length, 0)

        const tokens = await waitFor(async () => {
            const result = await vscode.commands.executeCommand<
                vscode.SemanticTokens | undefined
            >('vscode.provideDocumentSemanticTokens', document.uri)
            return result && result.data.length > 0 ? result : undefined
        })
        assert.ok(tokens.data.length > 0)
    })
})
