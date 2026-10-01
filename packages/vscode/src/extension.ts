import * as vscode from 'vscode'
import { ClawrCodeActionProvider } from './code-actions'
import { createDiagnosticsProvider } from './diagnostics-provider'
import { clearParsedDocument } from './document-cache'
import { ClawrRenameProvider } from './rename-provider'
import {
    ClawrSemanticTokensProvider,
    semanticTokensLegend,
} from './semantic-tokens'

const CLAWR_LANGUAGE = { language: 'clawr' }

export function activate(context: vscode.ExtensionContext): void {
    const diagnostics = createDiagnosticsProvider()

    context.subscriptions.push(
        diagnostics.collection,
        vscode.workspace.onDidOpenTextDocument(diagnostics.update),
        vscode.workspace.onDidChangeTextDocument((event) =>
            diagnostics.update(event.document),
        ),
        vscode.workspace.onDidCloseTextDocument((document) => {
            clearParsedDocument(document.uri)
            diagnostics.collection.delete(document.uri)
        }),
        vscode.languages.registerDocumentSemanticTokensProvider(
            CLAWR_LANGUAGE,
            new ClawrSemanticTokensProvider(),
            semanticTokensLegend,
        ),
        vscode.languages.registerCodeActionsProvider(
            CLAWR_LANGUAGE,
            new ClawrCodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
        ),
        vscode.languages.registerRenameProvider(
            CLAWR_LANGUAGE,
            new ClawrRenameProvider(),
        ),
    )

    for (const document of vscode.workspace.textDocuments)
        diagnostics.update(document)
}

export function deactivate(): void {}
