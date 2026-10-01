import type { SemanticTokenKind } from '@clawr/frontend/tools'
import * as vscode from 'vscode'
import { getParsedDocument } from './document-cache'
import { toPosition } from './spans'

const tokenTypeMap: Record<SemanticTokenKind, string> = {
    variable: 'variable',
    parameter: 'parameter',
    field: 'property',
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
    provideDocumentSemanticTokens(
        document: vscode.TextDocument,
    ): vscode.ProviderResult<vscode.SemanticTokens> {
        const { highlights } = getParsedDocument(document)
        const builder = new vscode.SemanticTokensBuilder(semanticTokensLegend)

        const sorted = [...highlights].sort(
            (a, b) =>
                a.span.start.line - b.span.start.line ||
                a.span.start.column - b.span.start.column,
        )

        for (const highlight of sorted) {
            // Multi-line spans aren't supported by SemanticTokensBuilder; skip them.
            if (highlight.span.end.line !== highlight.span.start.line) continue

            const start = toPosition(highlight.span.start)
            const length =
                highlight.span.end.column - highlight.span.start.column
            builder.push(
                new vscode.Range(start, start.translate(0, length)),
                tokenTypeMap[highlight.kind],
                highlight.modifiers,
            )
        }

        return builder.build()
    }
}
