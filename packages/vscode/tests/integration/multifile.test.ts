import * as assert from 'assert'
import * as vscode from 'vscode'
import { openFixture, waitFor } from './util'

suite('Multi-file analysis', () => {
    test('resolves definitions and reacts to unsaved changes in another file', async () => {
        const main = await openFixture('multifile/main.clawr')
        const helper = await openFixture('multifile/helper.clawr')
        const definitions = await waitFor(async () => {
            const result = await vscode.commands.executeCommand<
                vscode.Location[]
            >(
                'vscode.executeDefinitionProvider',
                main.uri,
                new vscode.Position(1, 11),
            )
            return result?.length ? result : undefined
        })
        assert.strictEqual(definitions[0].uri.toString(), helper.uri.toString())
        assert.strictEqual(definitions[0].range.start.character, 5)

        const change = new vscode.WorkspaceEdit()
        change.replace(helper.uri, new vscode.Range(0, 5, 0, 11), 'renamed')
        assert.ok(await vscode.workspace.applyEdit(change))
        try {
            await waitFor(() =>
                vscode.languages
                    .getDiagnostics(main.uri)
                    .some((item) => item.message.includes('number'))
                    ? true
                    : undefined,
            )
        } finally {
            const restore = new vscode.WorkspaceEdit()
            restore.replace(helper.uri, new vscode.Range(0, 5, 0, 12), 'number')
            assert.ok(await vscode.workspace.applyEdit(restore))
        }
        await waitFor(() =>
            vscode.languages.getDiagnostics(main.uri).length === 0
                ? true
                : undefined,
        )
    })
})
