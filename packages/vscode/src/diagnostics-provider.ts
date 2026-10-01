import * as vscode from 'vscode'
import { getParsedDocument } from './document-cache'
import { toRange } from './spans'

export function createDiagnosticsProvider(): {
    collection: vscode.DiagnosticCollection
    update(document: vscode.TextDocument): void
    dispose(): void
} {
    const collection = vscode.languages.createDiagnosticCollection('clawr')

    function update(document: vscode.TextDocument): void {
        if (document.languageId !== 'clawr') return
        const { diagnostics } = getParsedDocument(document)
        collection.set(
            document.uri,
            diagnostics.map(
                (d) =>
                    new vscode.Diagnostic(
                        toRange(d.span),
                        d.message,
                        d.severity === 'error'
                            ? vscode.DiagnosticSeverity.Error
                            : vscode.DiagnosticSeverity.Warning,
                    ),
            ),
        )
    }

    return {
        collection,
        update,
        dispose: () => collection.dispose(),
    }
}
