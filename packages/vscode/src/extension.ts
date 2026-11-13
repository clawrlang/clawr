import * as vscode from 'vscode'
import { ClawrCodeActionProvider } from './code-actions'
import { ClawrDefinitionProvider } from './definition-provider'
import { clearParsedDocument } from './document-cache'
import { ClawrRenameProvider } from './rename-provider'
import { WorkspaceAnalysis } from './workspace-analysis'
import {
    ClawrSemanticTokensProvider,
    semanticTokensLegend,
} from './semantic-tokens'

const CLAWR_LANGUAGE = { language: 'clawr' }

export function activate(context: vscode.ExtensionContext): void {
    const analysis = new WorkspaceAnalysis()
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.clawr')
    const projectWatcher =
        vscode.workspace.createFileSystemWatcher('**/.clawr-project')

    context.subscriptions.push(
        analysis,
        watcher,
        projectWatcher,
        watcher.onDidCreate(() => analysis.invalidate()),
        watcher.onDidChange(() => analysis.invalidate()),
        watcher.onDidDelete(() => analysis.invalidate()),
        projectWatcher.onDidCreate(() => analysis.invalidate()),
        projectWatcher.onDidChange(() => analysis.invalidate()),
        projectWatcher.onDidDelete(() => analysis.invalidate()),
        vscode.workspace.onDidRenameFiles((event) => {
            if (
                event.files.some(({ oldUri, newUri }) =>
                    [oldUri, newUri].some(
                        (uri) =>
                            uri.path.endsWith('.clawr') ||
                            uri.path.endsWith('/.clawr-project'),
                    ),
                )
            )
                analysis.invalidate()
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() =>
            analysis.invalidate(),
        ),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('files.exclude'))
                analysis.invalidate()
        }),
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (document.languageId === 'clawr') analysis.invalidate()
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.languageId === 'clawr') {
                clearParsedDocument(event.document.uri)
                analysis.invalidate()
            }
        }),
        vscode.workspace.onDidCloseTextDocument((document) => {
            clearParsedDocument(document.uri)
            if (document.languageId === 'clawr') analysis.invalidate()
        }),
        vscode.languages.registerDocumentSemanticTokensProvider(
            CLAWR_LANGUAGE,
            new ClawrSemanticTokensProvider(analysis),
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
        vscode.languages.registerDefinitionProvider(
            CLAWR_LANGUAGE,
            new ClawrDefinitionProvider(analysis),
        ),
    )

    analysis.invalidate()
}

export function deactivate(): void {}
