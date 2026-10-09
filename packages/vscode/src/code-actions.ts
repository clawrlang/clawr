import * as vscode from 'vscode'
import { getParsedDocument } from './document-cache'
import { levenshteinDistance } from './levenshtein'
import { toRange } from './spans'

const MAX_SUGGESTION_DISTANCE = 2

const UNKNOWN_VARIABLE =
    /^Variable (\S+) is not defined in the current context$/
const UNKNOWN_PROPERTY = /^Property (\S+) does not exist on type /

export class ClawrCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
    ): vscode.ProviderResult<vscode.CodeAction[]> {
        const { highlights } = getParsedDocument(document)
        const declaredNames = new Set(
            highlights
                .filter((h) => h.modifiers.includes('declaration'))
                .map((h) => document.getText(toRange(h.span))),
        )

        const actions: vscode.CodeAction[] = []
        for (const diagnostic of context.diagnostics) {
            const match =
                UNKNOWN_VARIABLE.exec(diagnostic.message) ??
                UNKNOWN_PROPERTY.exec(diagnostic.message)
            if (!match) continue

            const unknownName = match[1]
            const suggestion = didYouMean(unknownName, declaredNames)
            if (!suggestion) continue

            const action = new vscode.CodeAction(
                `Did you mean '${suggestion}'?`,
                vscode.CodeActionKind.QuickFix,
            )
            action.edit = new vscode.WorkspaceEdit()
            action.edit.replace(document.uri, diagnostic.range, suggestion)
            action.diagnostics = [diagnostic]
            action.isPreferred = true
            actions.push(action)
        }
        return actions
    }
}

function didYouMean(
    unknownName: string,
    candidates: Set<string>,
): string | undefined {
    let best: { name: string; distance: number } | undefined
    for (const name of candidates) {
        if (name === unknownName) continue
        const distance = levenshteinDistance(unknownName, name)
        if (distance > MAX_SUGGESTION_DISTANCE) continue
        if (!best || distance < best.distance) best = { name, distance }
    }
    return best?.name
}
