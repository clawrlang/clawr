import type { Position, SourceCodeSpan } from '@clawr/frontend/tools'
import * as vscode from 'vscode'

/** Clawr positions are 1-indexed; VS Code positions are 0-indexed. */
export function toPosition(position: Position): vscode.Position {
    return new vscode.Position(position.line - 1, position.column - 1)
}

export function toRange(span: SourceCodeSpan): vscode.Range {
    return new vscode.Range(toPosition(span.start), toPosition(span.end))
}
