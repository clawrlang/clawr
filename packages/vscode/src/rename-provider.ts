import * as vscode from 'vscode'
import { getParsedDocument } from './document-cache'
import { toRange } from './spans'

/**
 * Single-file, name-matching rename: all `variable`/`parameter` highlights in
 * the document sharing the same identifier text are renamed together. This
 * does not track lexical scope, so two unrelated variables that happen to
 * share a name (e.g. shadowed in different functions) will be renamed as one.
 */
export class ClawrRenameProvider implements vscode.RenameProvider {
    prepareRename(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.ProviderResult<vscode.Range> {
        const range = document.getWordRangeAtPosition(position)
        if (!range) throw new Error('No renameable symbol at this position')
        return range
    }

    provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
    ): vscode.ProviderResult<vscode.WorkspaceEdit> {
        const range = document.getWordRangeAtPosition(position)
        if (!range) return undefined
        const name = document.getText(range)

        const { highlights } = getParsedDocument(document)
        const matches = highlights.filter(
            (h) =>
                (h.kind === 'variable' || h.kind === 'parameter') &&
                document.getText(toRange(h.span)) === name,
        )
        if (matches.length === 0) return undefined

        const edit = new vscode.WorkspaceEdit()
        for (const highlight of matches)
            edit.replace(document.uri, toRange(highlight.span), newName)
        return edit
    }
}
