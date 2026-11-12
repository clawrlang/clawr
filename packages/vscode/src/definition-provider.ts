import * as vscode from 'vscode'
import { toRange } from './spans'
import { WorkspaceAnalysis } from './workspace-analysis'

export class ClawrDefinitionProvider implements vscode.DefinitionProvider {
    constructor(private readonly analysis: WorkspaceAnalysis) {}

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<vscode.Location | undefined> {
        const result = await this.analysis.document(document)
        const reference = result.definitions.find((item) =>
            toRange(item.span).contains(position),
        )
        const source = reference?.definition.start.source
        return reference && source
            ? new vscode.Location(
                  vscode.Uri.parse(source),
                  toRange(reference.definition),
              )
            : undefined
    }
}
