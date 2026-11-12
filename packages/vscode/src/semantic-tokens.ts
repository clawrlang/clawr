import type { SemanticTokenKind } from '@clawr/frontend/tools'
import * as vscode from 'vscode'
import { toPosition } from './spans'
import { WorkspaceAnalysis } from './workspace-analysis'

const tokenTypeMap: Record<SemanticTokenKind, string> = {
    variable: 'variable',
    parameter: 'parameter',
    property: 'property',
    type: 'type',
    function: 'function',
}

export const semanticTokensLegend = new vscode.SemanticTokensLegend(
    ['variable', 'parameter', 'type', 'function', 'property'],
    ['declaration', 'readonly', 'shared'],
)

export class ClawrSemanticTokensProvider
    implements vscode.DocumentSemanticTokensProvider
{
    readonly onDidChangeSemanticTokens: vscode.Event<void>

    constructor(private readonly analysis: WorkspaceAnalysis) {
        this.onDidChangeSemanticTokens = analysis.onDidChange
    }

    async provideDocumentSemanticTokens(
        document: vscode.TextDocument,
    ): Promise<vscode.SemanticTokens> {
        const { highlights } = await this.analysis.document(document)
        const builder = new vscode.SemanticTokensBuilder(semanticTokensLegend)

        const sorted = [...highlights].sort(
            (a, b) =>
                a.span.start.line - b.span.start.line ||
                a.span.start.column - b.span.start.column,
        )

        let lastLine = -1
        let lastEnd = -1
        for (const highlight of sorted) {
            // Multi-line spans aren't supported by SemanticTokensBuilder; skip them.
            if (highlight.span.end.line !== highlight.span.start.line) continue

            const start = toPosition(highlight.span.start)
            const length =
                highlight.span.end.column - highlight.span.start.column
            if (start.line === lastLine && start.character < lastEnd) continue
            builder.push(
                new vscode.Range(start, start.translate(0, length)),
                tokenTypeMap[highlight.kind],
                highlight.modifiers,
            )
            lastLine = start.line
            lastEnd = start.character + length
        }

        return builder.build()
    }
}
