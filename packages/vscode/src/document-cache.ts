import * as vscode from 'vscode'
import { ParsedDocument, parseDocument } from './parse-document'

type CacheEntry = { version: number; result: ParsedDocument }

const cache = new Map<string, CacheEntry>()

export function getParsedDocument(
    document: vscode.TextDocument,
): ParsedDocument {
    const key = document.uri.toString()
    const cached = cache.get(key)
    if (cached && cached.version === document.version) return cached.result

    const result = parseDocument(document.getText())
    cache.set(key, { version: document.version, result })
    return result
}

export function clearParsedDocument(uri: vscode.Uri): void {
    cache.delete(uri.toString())
}
