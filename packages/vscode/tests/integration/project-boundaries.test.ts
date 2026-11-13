import * as assert from 'assert'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as vscode from 'vscode'
import { waitFor } from './util'

async function updateFolders(
    index: number,
    deleteCount: number,
    ...folders: { uri: vscode.Uri; name: string }[]
): Promise<void> {
    let listener: vscode.Disposable
    const changed = new Promise<void>((resolve) => {
        listener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
            listener.dispose()
            resolve()
        })
    })
    if (!vscode.workspace.updateWorkspaceFolders(index, deleteCount, ...folders)) {
        listener!.dispose()
        throw new Error('Failed to update workspace folders')
    }
    await changed
}

suite('Project boundaries', () => {
    test('analyzes the compiler cases as independent programs', async () => {
        const folders = vscode.workspace.workspaceFolders ?? []
        assert.ok(folders.length)
        const cases = vscode.Uri.joinPath(
            folders[0].uri,
            '../../../../rwrc/test/cases',
        )
        await updateFolders(folders.length, 0, {
            uri: cases,
            name: 'compiler-cases-test',
        })
        try {
            const errorCase = await vscode.workspace.openTextDocument(
                vscode.Uri.joinPath(cases, 'real-precision-error.clawr'),
            )
            await waitFor(
                () =>
                    vscode.languages.getDiagnostics(errorCase.uri).length
                        ? true
                        : undefined,
                { timeoutMs: 20000 },
            )
            const files = await vscode.workspace.fs.readDirectory(cases)
            for (const [name, type] of files) {
                if (type !== vscode.FileType.File || !name.endsWith('.clawr'))
                    continue
                const diagnostics = vscode.languages.getDiagnostics(
                    vscode.Uri.joinPath(cases, name),
                )
                assert.ok(
                    diagnostics.every(
                        (diagnostic) =>
                            !diagnostic.message.includes('Multiple @main'),
                    ),
                    `${name} has a spurious multiple-main diagnostic`,
                )
            }
        } finally {
            const index = (vscode.workspace.workspaceFolders ?? []).findIndex(
                (folder) => folder.uri.toString() === cases.toString(),
            )
            if (index >= 0) await updateFolders(index, 1)
        }
    })

    test('isolates scripts and nested projects and reacts to marker changes', async () => {
        const root = mkdtempSync(join(tmpdir(), 'clawr-project-test-'))
        const path = (...parts: string[]) => join(root, ...parts)
        const uri = (...parts: string[]) => vscode.Uri.file(path(...parts))
        mkdirSync(path('nested'))
        mkdirSync(path('ordered'))
        mkdirSync(path('workspace'))
        writeFileSync(path('a.clawr'), '@main { print(number()) }')
        writeFileSync(path('b.clawr'), 'func number() => 42')
        writeFileSync(path('c.clawr'), '@main {}')
        writeFileSync(path('independent.script.clawr'), '@main { print(number()) }')
        writeFileSync(path('nested', '.clawr-project'), '')
        writeFileSync(path('nested', 'a.clawr'), '@main { print(nestedNumber()) }')
        writeFileSync(path('nested', 'b.clawr'), 'func nestedNumber() => 42')
        writeFileSync(path('ordered', '.clawr-project'), '')
        writeFileSync(path('ordered', 'a-types.clawr'), 'subset Count = integer(0...10)')
        writeFileSync(path('ordered', 'b-main.clawr'), '@main { const value: Count = 2 print(value) }')
        writeFileSync(path('workspace', 'a.clawr'), '@main { print(number()) }')

        const folders = vscode.workspace.workspaceFolders ?? []
        await updateFolders(
            folders.length,
            0,
            { uri: uri(), name: 'project-boundary-test' },
            { uri: uri('workspace'), name: 'nested-workspace-test' },
        )
        try {
            await waitFor(
                () =>
                    vscode.workspace.getWorkspaceFolder(uri('workspace', 'a.clawr'))
                        ?.uri.toString() === uri('workspace').toString()
                        ? true
                        : undefined,
                { timeoutMs: 20000 },
            )
            const main = await vscode.workspace.openTextDocument(uri('a.clawr'))
            const script = await vscode.workspace.openTextDocument(
                uri('independent.script.clawr'),
            )
            const nested = await vscode.workspace.openTextDocument(
                uri('nested', 'a.clawr'),
            )
            const ordered = await vscode.workspace.openTextDocument(
                uri('ordered', 'b-main.clawr'),
            )
            const otherWorkspace = await vscode.workspace.openTextDocument(
                uri('workspace', 'a.clawr'),
            )
            const definitions = (document: vscode.TextDocument, character: number) =>
                vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeDefinitionProvider',
                    document.uri,
                    new vscode.Position(0, character),
                )
            const hasDiagnostic = (document: vscode.TextDocument, text: string) =>
                vscode.languages
                    .getDiagnostics(document.uri)
                    .some((diagnostic) => diagnostic.message.includes(text))
            const waitOptions = { timeoutMs: 20000 }

            await waitFor(
                () => (hasDiagnostic(main, 'number') ? true : undefined),
                waitOptions,
            )
            assert.ok(!(await definitions(main, 15))?.length)
            const nestedDefinitions = await waitFor(async () => {
                const found = await definitions(nested, 15)
                return found?.length ? found : undefined
            }, waitOptions)
            assert.strictEqual(
                nestedDefinitions[0].uri.toString(),
                uri('nested', 'b.clawr').toString(),
            )
            const aliasDefinitions = await waitFor(async () => {
                const found = await definitions(
                    ordered,
                    ordered.getText().indexOf('Count') + 1,
                )
                return found?.length ? found : undefined
            }, waitOptions)
            assert.strictEqual(
                aliasDefinitions[0].uri.toString(),
                uri('ordered', 'a-types.clawr').toString(),
            )

            const marker = uri('.clawr-project')
            const renamedMarker = uri('.clawr-project-disabled')
            await vscode.workspace.fs.writeFile(marker, new Uint8Array())
            const projectDefinitions = await waitFor(async () => {
                const found = await definitions(main, 15)
                return found?.length ? found : undefined
            }, waitOptions)
            assert.strictEqual(
                projectDefinitions[0].uri.toString(),
                uri('b.clawr').toString(),
            )
            const duplicate = await vscode.workspace.openTextDocument(uri('c.clawr'))
            await waitFor(
                () => (hasDiagnostic(duplicate, 'Multiple @main') ? true : undefined),
                waitOptions,
            )
            await waitFor(
                () =>
                    hasDiagnostic(script, 'number') &&
                    hasDiagnostic(otherWorkspace, 'number')
                        ? true
                        : undefined,
                waitOptions,
            )
            assert.ok(!(await definitions(script, 15))?.length)
            assert.ok(!(await definitions(otherWorkspace, 15))?.length)
            assert.ok(!hasDiagnostic(nested, 'Multiple @main'))

            await vscode.workspace.fs.rename(marker, renamedMarker)
            await waitFor(
                async () => (!(await definitions(main, 15))?.length ? true : undefined),
                waitOptions,
            )
            await waitFor(
                () => (hasDiagnostic(main, 'number') ? true : undefined),
                waitOptions,
            )
            assert.ok(!hasDiagnostic(duplicate, 'Multiple @main'))

            await vscode.workspace.fs.rename(renamedMarker, marker)
            await waitFor(async () => {
                const found = await definitions(main, 15)
                return found?.length ? true : undefined
            }, waitOptions)
            await vscode.workspace.fs.delete(marker)
            await waitFor(
                async () => (!(await definitions(main, 15))?.length ? true : undefined),
                waitOptions,
            )
        } finally {
            try {
                const current = vscode.workspace.workspaceFolders ?? []
                for (const folder of [...current].reverse()) {
                    if (
                        folder.uri.toString() !== uri().toString() &&
                        folder.uri.toString() !== uri('workspace').toString()
                    )
                        continue
                    const index = (vscode.workspace.workspaceFolders ?? []).findIndex(
                        (item) => item.uri.toString() === folder.uri.toString(),
                    )
                    if (index < 0) continue
                    await updateFolders(index, 1)
                }
            } finally {
                rmSync(root, { recursive: true, force: true })
            }
        }
    })
})
