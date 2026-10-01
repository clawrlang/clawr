import * as vscode from 'vscode'

export async function waitFor<T>(
    check: () => T | undefined | Promise<T | undefined>,
    { timeoutMs = 5000, intervalMs = 50 } = {},
): Promise<T> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const result = await check()
        if (result !== undefined) return result
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    throw new Error('waitFor: condition was not met before timeout')
}

export async function openFixture(
    relativePath: string,
): Promise<vscode.TextDocument> {
    const [workspaceFolder] = vscode.workspace.workspaceFolders ?? []
    if (!workspaceFolder) throw new Error('No workspace folder open')
    const uri = vscode.Uri.joinPath(workspaceFolder.uri, relativePath)
    const document = await vscode.workspace.openTextDocument(uri)
    await vscode.window.showTextDocument(document)
    return document
}
