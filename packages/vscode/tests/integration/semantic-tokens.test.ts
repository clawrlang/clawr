import * as assert from 'assert'
import * as vscode from 'vscode'
import { openFixture, waitFor } from './util'

suite('Semantic tokens', () => {
    test('classifies a declared variable', async () => {
        const document = await openFixture('valid.clawr')

        const tokens = await waitFor(async () => {
            const result = await vscode.commands.executeCommand<
                vscode.SemanticTokens | undefined
            >('vscode.provideDocumentSemanticTokens', document.uri)
            return result && result.data.length > 0 ? result : undefined
        })

        assert.ok(tokens)
        assert.ok(tokens.data.length > 0)
    })
})

suite('Code actions', () => {
    test('offers a did-you-mean quick fix for an unknown variable', async () => {
        const document = await openFixture('typo.clawr')

        await waitFor(() =>
            vscode.languages.getDiagnostics(document.uri).length > 0
                ? true
                : undefined,
        )

        const range = new vscode.Range(0, 0, document.lineCount, 0)
        const actions = await waitFor(async () => {
            const result = await vscode.commands.executeCommand<
                vscode.CodeAction[]
            >('vscode.executeCodeActionProvider', document.uri, range)
            return result.length > 0 ? result : undefined
        })

        assert.ok(actions.some((a) => a.title.includes('Did you mean')))
    })
})
